import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticateSupabase } from '../middleware/supabaseAuth.js';
import { storage } from '../storage';
import { db } from '../db';
import { crewMembers, projects, crews, clients, projectNotes, projectFiles, reclamations, services } from '@shared/schema';
import { eq, and, desc, gte, lte, inArray } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Middleware to check worker role and get crew member info
async function requireWorker(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'worker') {
    return res.status(403).json({ error: 'Worker access required' });
  }

  // First check if crewMemberId is already in the user profile from auth middleware
  if (req.user.crewMemberId) {
    // Get crew info using crewMemberId from profile
    const [memberInfo] = await db
      .select({ crewId: crewMembers.crewId })
      .from(crewMembers)
      .where(eq(crewMembers.id, req.user.crewMemberId));

    if (!memberInfo) {
      return res.status(403).json({ error: 'Crew member not found' });
    }

    (req as any).workerInfo = {
      crewMemberId: req.user.crewMemberId,
      crewId: memberInfo.crewId,
    };

    return next();
  }

  // Fallback: Get the crew member ID by authUserId
  const profile = await db
    .select({ crew_member_id: crewMembers.id, crewId: crewMembers.crewId })
    .from(crewMembers)
    .where(eq(crewMembers.authUserId, req.user.id))
    .limit(1);

  if (!profile || profile.length === 0) {
    return res.status(403).json({ error: 'Worker profile not found' });
  }

  // Attach crew info to request
  (req as any).workerInfo = {
    crewMemberId: profile[0].crew_member_id,
    crewId: profile[0].crewId,
  };

  next();
}

// Helper to check if worker has access to project
async function hasWorkerProjectAccess(crewId: number, projectId: number): Promise<boolean> {
  const [project] = await db
    .select({ crewId: projects.crewId })
    .from(projects)
    .where(eq(projects.id, projectId));

  return project && project.crewId === crewId;
}

/**
 * GET /api/worker/profile
 * Get worker's profile information
 */
router.get('/profile', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;

    const [member] = await db
      .select({
        id: crewMembers.id,
        firstName: crewMembers.firstName,
        lastName: crewMembers.lastName,
        email: crewMembers.memberEmail,
        phone: crewMembers.phone,
        crewId: crewMembers.crewId,
      })
      .from(crewMembers)
      .where(eq(crewMembers.id, workerInfo.crewMemberId));

    if (!member) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Get crew info
    const [crew] = await db
      .select({ id: crews.id, name: crews.name, uniqueNumber: crews.uniqueNumber })
      .from(crews)
      .where(eq(crews.id, member.crewId));

    res.json({
      ...member,
      crew,
    });
  } catch (error: any) {
    console.error('Error fetching worker profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * GET /api/worker/projects
 * Get all projects assigned to worker's crew
 */
router.get('/projects', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const { status, from, to } = req.query;

    let query = db
      .select({
        id: projects.id,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        workStartDate: projects.workStartDate,
        workEndDate: projects.workEndDate,
        installationPersonFirstName: projects.installationPersonFirstName,
        installationPersonLastName: projects.installationPersonLastName,
        installationPersonAddress: projects.installationPersonAddress,
        installationPersonPhone: projects.installationPersonPhone,
        notes: projects.notes,
        clientId: projects.clientId,
        crewId: projects.crewId,
      })
      .from(projects)
      .where(eq(projects.crewId, workerInfo.crewId))
      .orderBy(desc(projects.workStartDate));

    const projectList = await query;

    // Enrich with client info
    const enrichedProjects = await Promise.all(
      projectList.map(async (project) => {
        const [client] = await db
          .select({ name: clients.name, address: clients.address })
          .from(clients)
          .where(eq(clients.id, project.clientId));

        return {
          ...project,
          client,
        };
      })
    );

    res.json(enrichedProjects);
  } catch (error: any) {
    console.error('Error fetching worker projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/worker/projects/:projectId/reclamations
 * Get reclamations for a project (only ones assigned to worker's crew)
 * Note: Access is allowed if either the project OR the reclamation is assigned to the crew
 */
router.get('/projects/:projectId/reclamations', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Get reclamations for this project that are assigned to worker's crew
    // No project access check here - the crew might have a reclamation assigned
    // even if the original project was assigned to another crew
    const projectReclamations = await db
      .select({
        id: reclamations.id,
        description: reclamations.description,
        deadline: reclamations.deadline,
        status: reclamations.status,
        createdAt: reclamations.createdAt,
      })
      .from(reclamations)
      .where(
        and(
          eq(reclamations.projectId, projectId),
          eq(reclamations.currentCrewId, workerInfo.crewId),
          inArray(reclamations.status, ['pending', 'accepted', 'in_progress'])
        )
      )
      .orderBy(desc(reclamations.createdAt));

    console.log(`[Worker Reclamations] Project ${projectId}, Crew ${workerInfo.crewId}: Found ${projectReclamations.length} reclamations`);

    res.json({ reclamations: projectReclamations });
  } catch (error: any) {
    console.error('Error fetching project reclamations:', error);
    res.status(500).json({ error: 'Failed to fetch reclamations' });
  }
});

/**
 * GET /api/worker/projects/:id
 * Get project details
 */
router.get('/projects/:id', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check access
    const hasAccess = await hasWorkerProjectAccess(workerInfo.crewId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const [project] = await db
      .select({
        id: projects.id,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        workStartDate: projects.workStartDate,
        workEndDate: projects.workEndDate,
        equipmentExpectedDate: projects.equipmentExpectedDate,
        equipmentArrivedDate: projects.equipmentArrivedDate,
        installationPersonFirstName: projects.installationPersonFirstName,
        installationPersonLastName: projects.installationPersonLastName,
        installationPersonAddress: projects.installationPersonAddress,
        installationPersonPhone: projects.installationPersonPhone,
        notes: projects.notes,
        clientId: projects.clientId,
        crewId: projects.crewId,
      })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get client info
    const [client] = await db
      .select({ name: clients.name, address: clients.address, phone: clients.phone })
      .from(clients)
      .where(eq(clients.id, project.clientId));

    // Get project files
    const files = await storage.getFilesByProjectId(projectId);

    // Get project notes (comments)
    const comments = await db
      .select()
      .from(projectNotes)
      .where(eq(projectNotes.projectId, projectId))
      .orderBy(desc(projectNotes.createdAt));

    res.json({
      ...project,
      client,
      files,
      comments,
    });
  } catch (error: any) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

/**
 * GET /api/worker/projects/:projectId/services
 * Get services for a project (description and quantity only, no prices)
 */
router.get('/projects/:projectId/services', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check access
    const hasAccess = await hasWorkerProjectAccess(workerInfo.crewId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    // Get services for this project (only description and quantity - no price!)
    const projectServices = await db
      .select({
        id: services.id,
        description: services.description,
        quantity: services.quantity,
        productKey: services.productKey,
      })
      .from(services)
      .where(eq(services.projectId, projectId));

    res.json({ services: projectServices });
  } catch (error: any) {
    console.error('Error fetching project services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * POST /api/worker/projects/:id/photos
 * Upload photos for a project
 */
router.post('/projects/:id/photos', authenticateSupabase, requireWorker, upload.array('photos', 10), async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check access
    const hasAccess = await hasWorkerProjectAccess(workerInfo.crewId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Create unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext).replace(/[^\w\-\.]/g, '_');
      const fileName = `worker_${workerInfo.crewMemberId}_${baseName}_${timestamp}${ext}`;

      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, fileName);

      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Save file
      fs.writeFileSync(filePath, file.buffer);

      // Create database record
      const savedFile = await storage.createFile({
        projectId,
        fileName,
        fileUrl: `/api/files/download/${fileName}`,
        fileType: file.mimetype,
      });

      // Add to history
      await storage.addProjectHistory({
        projectId,
        userId: req.user!.id,
        changeType: 'file_added',
        fieldName: 'file',
        oldValue: null,
        newValue: file.originalname,
        description: `Worker uploaded photo: ${file.originalname}`,
      });

      uploadedFiles.push({
        id: savedFile.id,
        fileName: savedFile.fileName,
        fileUrl: savedFile.fileUrl,
      });
    }

    // Get project to find leiter and send notification
    const [project] = await db
      .select({ leiterId: projects.leiterId })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (project && project.leiterId) {
      // Get worker name
      const [workerMember] = await db
        .select({ firstName: crewMembers.firstName, lastName: crewMembers.lastName })
        .from(crewMembers)
        .where(eq(crewMembers.id, workerInfo.crewMemberId));

      const workerName = workerMember
        ? `${workerMember.firstName} ${workerMember.lastName}`.trim()
        : 'Работник';

      // Create notification for leiter
      await storage.createNotification({
        userId: project.leiterId,
        projectId,
        type: 'file_added',
        title: `Новое фото в проекте #${projectId}`,
        message: `${workerName} добавил ${uploadedFiles.length} фото`,
        link: `/projects/${projectId}?tab=files`,
        sourceUserId: req.user!.id,
      });
    }

    res.json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length} photo(s) uploaded successfully`,
    });
  } catch (error: any) {
    console.error('Error uploading photos:', error);
    res.status(500).json({ error: 'Failed to upload photos' });
  }
});

/**
 * POST /api/worker/projects/:id/comments
 * Add a comment/note to a project
 */
router.post('/projects/:id/comments', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check access
    const hasAccess = await hasWorkerProjectAccess(workerInfo.crewId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const { content, priority } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Create note
    const [note] = await db.insert(projectNotes).values({
      projectId,
      userId: req.user!.id,
      content: content.trim(),
      priority: priority || 'normal',
    }).returning();

    // Add to history
    await storage.addProjectHistory({
      projectId,
      userId: req.user!.id,
      changeType: 'note_added',
      fieldName: 'note',
      oldValue: null,
      newValue: content.substring(0, 100),
      description: `Worker added comment: ${content.substring(0, 50)}...`,
    });

    // Get project to find leiter and send notification
    const [project] = await db
      .select({ leiterId: projects.leiterId })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (project && project.leiterId) {
      // Get worker name
      const [workerMember] = await db
        .select({ firstName: crewMembers.firstName, lastName: crewMembers.lastName })
        .from(crewMembers)
        .where(eq(crewMembers.id, workerInfo.crewMemberId));

      const workerName = workerMember
        ? `${workerMember.firstName} ${workerMember.lastName}`.trim()
        : 'Работник';

      // Create notification for leiter
      await storage.createNotification({
        userId: project.leiterId,
        projectId,
        type: 'note_added',
        title: `Комментарий в проекте #${projectId}`,
        message: `${workerName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
        link: `/projects/${projectId}?tab=history`,
        sourceUserId: req.user!.id,
      });
    }

    res.json({
      success: true,
      note,
    });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * GET /api/worker/calendar
 * Get calendar events for worker's crew (projects with dates)
 */
router.get('/calendar', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const { month, year } = req.query;

    // Default to current month
    const targetMonth = month ? parseInt(month as string) : new Date().getMonth() + 1;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // Get projects for the crew within the date range
    const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfMonth = new Date(targetYear, targetMonth, 0);

    const projectList = await db
      .select({
        id: projects.id,
        status: projects.status,
        workStartDate: projects.workStartDate,
        workEndDate: projects.workEndDate,
        installationPersonFirstName: projects.installationPersonFirstName,
        installationPersonLastName: projects.installationPersonLastName,
        installationPersonAddress: projects.installationPersonAddress,
        clientId: projects.clientId,
      })
      .from(projects)
      .where(eq(projects.crewId, workerInfo.crewId));

    // Filter projects that overlap with the target month
    const filteredProjects = projectList.filter((project) => {
      if (!project.workStartDate && !project.workEndDate) return false;

      const projectStart = project.workStartDate ? new Date(project.workStartDate) : null;
      const projectEnd = project.workEndDate ? new Date(project.workEndDate) : null;

      // Check if project overlaps with the month
      if (projectStart && projectEnd) {
        return projectStart <= endOfMonth && projectEnd >= startOfMonth;
      } else if (projectStart) {
        return projectStart >= startOfMonth && projectStart <= endOfMonth;
      } else if (projectEnd) {
        return projectEnd >= startOfMonth && projectEnd <= endOfMonth;
      }
      return false;
    });

    // Enrich with client info
    const projectEvents = await Promise.all(
      filteredProjects.map(async (project) => {
        const [client] = await db
          .select({ name: clients.name })
          .from(clients)
          .where(eq(clients.id, project.clientId));

        return {
          id: project.id,
          title: client?.name || 'Unknown Client',
          start: project.workStartDate,
          end: project.workEndDate,
          status: project.status,
          address: project.installationPersonAddress,
          personName: [project.installationPersonFirstName, project.installationPersonLastName]
            .filter(Boolean)
            .join(' '),
          type: 'project' as const,
        };
      })
    );

    // Get reclamations for the crew with deadlines in the target month
    const crewReclamations = await db
      .select({
        id: reclamations.id,
        projectId: reclamations.projectId,
        description: reclamations.description,
        deadline: reclamations.deadline,
        status: reclamations.status,
      })
      .from(reclamations)
      .where(
        and(
          eq(reclamations.currentCrewId, workerInfo.crewId),
          inArray(reclamations.status, ['pending', 'accepted', 'in_progress'])
        )
      );

    // Filter reclamations that have deadlines in the target month
    // Use string comparison to avoid timezone issues
    const startStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    const endStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const filteredReclamations = crewReclamations.filter((reclamation) => {
      if (!reclamation.deadline) return false;
      // Compare date strings directly (YYYY-MM-DD format)
      const deadlineStr = reclamation.deadline.split('T')[0]; // Get just date part
      return deadlineStr >= startStr && deadlineStr <= endStr;
    });

    // Enrich reclamations with project info
    const reclamationEvents = await Promise.all(
      filteredReclamations.map(async (reclamation) => {
        const [project] = await db
          .select({
            installationPersonFirstName: projects.installationPersonFirstName,
            installationPersonLastName: projects.installationPersonLastName,
            installationPersonAddress: projects.installationPersonAddress,
          })
          .from(projects)
          .where(eq(projects.id, reclamation.projectId));

        return {
          id: reclamation.id,
          title: `Рекламация: ${reclamation.description.substring(0, 30)}${reclamation.description.length > 30 ? '...' : ''}`,
          start: reclamation.deadline,
          end: reclamation.deadline,
          status: 'reclamation',
          address: project?.installationPersonAddress || null,
          personName: project ? [project.installationPersonFirstName, project.installationPersonLastName]
            .filter(Boolean)
            .join(' ') : '',
          type: 'reclamation' as const,
          reclamationStatus: reclamation.status,
          projectId: reclamation.projectId,
        };
      })
    );

    // Combine all events
    const calendarEvents = [...projectEvents, ...reclamationEvents];

    res.json({
      month: targetMonth,
      year: targetYear,
      events: calendarEvents,
    });
  } catch (error: any) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// ============================================
// RECLAMATION ENDPOINTS FOR WORKERS
// ============================================

/**
 * GET /api/worker/reclamations
 * Get reclamations for worker's crew (assigned and available to take)
 */
router.get('/reclamations', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;

    const reclamations = await storage.getReclamationsForCrew(workerInfo.crewId);

    // Enrich with project and client info
    const enrichReclamation = async (reclamation: any) => {
      const project = await storage.getProjectById(reclamation.projectId);
      let client = null;
      if (project) {
        const [clientData] = await db
          .select({ name: clients.name, address: clients.address })
          .from(clients)
          .where(eq(clients.id, project.clientId));
        client = clientData;
      }

      return {
        ...reclamation,
        project: project ? {
          id: project.id,
          status: project.status,
          installationPersonAddress: project.installationPersonAddress,
          installationPersonFirstName: project.installationPersonFirstName,
          installationPersonLastName: project.installationPersonLastName,
        } : null,
        client,
      };
    };

    const enrichedAssigned = await Promise.all(reclamations.assigned.map(enrichReclamation));
    const enrichedAvailable = await Promise.all(reclamations.available.map(enrichReclamation));

    res.json({
      assigned: enrichedAssigned,
      available: enrichedAvailable,
      totalCount: enrichedAssigned.length + enrichedAvailable.length,
    });
  } catch (error: any) {
    console.error('Error fetching worker reclamations:', error);
    res.status(500).json({ error: 'Failed to fetch reclamations' });
  }
});

/**
 * GET /api/worker/reclamations/count
 * Get count of active reclamations for worker's crew (for badge)
 */
router.get('/reclamations/count', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;

    const reclamations = await storage.getReclamationsForCrew(workerInfo.crewId);

    // Count only pending and in_progress reclamations
    const activeCount = reclamations.assigned.filter(
      r => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress'
    ).length;

    const availableCount = reclamations.available.length;

    res.json({
      activeCount,
      availableCount,
      totalCount: activeCount + availableCount,
    });
  } catch (error: any) {
    console.error('Error fetching reclamation count:', error);
    res.status(500).json({ error: 'Failed to fetch reclamation count' });
  }
});

/**
 * GET /api/worker/reclamations/:id
 * Get reclamation details
 */
router.get('/reclamations/:id', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const reclamationId = parseInt(req.params.id);

    if (isNaN(reclamationId)) {
      return res.status(400).json({ error: 'Invalid reclamation ID' });
    }

    const reclamation = await storage.getReclamationById(reclamationId);

    if (!reclamation) {
      return res.status(404).json({ error: 'Reclamation not found' });
    }

    // Check access: must be current crew or available (rejected by others)
    const isAssigned = reclamation.currentCrewId === workerInfo.crewId;
    const isAvailable = reclamation.status === 'rejected' && reclamation.originalCrewId !== workerInfo.crewId;

    if (!isAssigned && !isAvailable) {
      return res.status(403).json({ error: 'Access denied to this reclamation' });
    }

    // Get project and client info
    const project = await storage.getProjectById(reclamation.projectId);
    let client = null;
    if (project) {
      const [clientData] = await db
        .select({ name: clients.name, address: clients.address, phone: clients.phone })
        .from(clients)
        .where(eq(clients.id, project.clientId));
      client = clientData;
    }

    // Get history
    const history = await storage.getReclamationHistory(reclamationId);

    res.json({
      ...reclamation,
      project: project ? {
        id: project.id,
        status: project.status,
        installationPersonAddress: project.installationPersonAddress,
        installationPersonFirstName: project.installationPersonFirstName,
        installationPersonLastName: project.installationPersonLastName,
        installationPersonPhone: project.installationPersonPhone,
      } : null,
      client,
      history,
      isAssigned,
      isAvailable,
    });
  } catch (error: any) {
    console.error('Error fetching reclamation details:', error);
    res.status(500).json({ error: 'Failed to fetch reclamation details' });
  }
});

/**
 * POST /api/worker/reclamations/:id/accept
 * Accept a reclamation (adds to calendar)
 */
router.post('/reclamations/:id/accept', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const reclamationId = parseInt(req.params.id);

    if (isNaN(reclamationId)) {
      return res.status(400).json({ error: 'Invalid reclamation ID' });
    }

    const reclamation = await storage.getReclamationById(reclamationId);

    if (!reclamation) {
      return res.status(404).json({ error: 'Reclamation not found' });
    }

    // Check if reclamation is in valid state
    if (reclamation.status !== 'pending' && reclamation.status !== 'rejected') {
      return res.status(400).json({
        error: 'Reclamation cannot be accepted',
        currentStatus: reclamation.status
      });
    }

    // If rejected, another crew can take it
    if (reclamation.status === 'rejected') {
      // Update the current crew to this worker's crew
      await storage.updateReclamation(reclamationId, {
        currentCrewId: workerInfo.crewId,
      });
    } else {
      // Must be the assigned crew
      if (reclamation.currentCrewId !== workerInfo.crewId) {
        return res.status(403).json({ error: 'This reclamation is not assigned to your crew' });
      }
    }

    // Accept the reclamation
    const updated = await storage.acceptReclamation(reclamationId, workerInfo.crewMemberId);

    // Add to calendar by setting workStartDate on project to deadline
    const project = await storage.getProjectById(reclamation.projectId);
    if (project && reclamation.deadline) {
      await storage.updateProject(reclamation.projectId, {
        workStartDate: reclamation.deadline,
      });
    }

    res.json({
      success: true,
      reclamation: updated,
      message: 'Рекламация принята и добавлена в календарь',
    });
  } catch (error: any) {
    console.error('Error accepting reclamation:', error);
    res.status(500).json({ error: 'Failed to accept reclamation' });
  }
});

/**
 * POST /api/worker/reclamations/:id/reject
 * Reject a reclamation (with reason)
 */
router.post('/reclamations/:id/reject', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const reclamationId = parseInt(req.params.id);

    if (isNaN(reclamationId)) {
      return res.status(400).json({ error: 'Invalid reclamation ID' });
    }

    const { reason } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Причина отклонения обязательна (минимум 10 символов)' });
    }

    const reclamation = await storage.getReclamationById(reclamationId);

    if (!reclamation) {
      return res.status(404).json({ error: 'Reclamation not found' });
    }

    // Must be the assigned crew
    if (reclamation.currentCrewId !== workerInfo.crewId) {
      return res.status(403).json({ error: 'This reclamation is not assigned to your crew' });
    }

    // Check if reclamation is in valid state
    if (reclamation.status !== 'pending') {
      return res.status(400).json({
        error: 'Reclamation cannot be rejected',
        currentStatus: reclamation.status
      });
    }

    // Reject the reclamation
    const updated = await storage.rejectReclamation(reclamationId, workerInfo.crewMemberId, reason.trim());

    res.json({
      success: true,
      reclamation: updated,
      message: 'Рекламация отклонена.',
    });
  } catch (error: any) {
    console.error('Error rejecting reclamation:', error);
    res.status(500).json({ error: 'Failed to reject reclamation' });
  }
});

/**
 * POST /api/worker/reclamations/:id/complete
 * Mark reclamation as completed
 */
router.post('/reclamations/:id/complete', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const reclamationId = parseInt(req.params.id);

    if (isNaN(reclamationId)) {
      return res.status(400).json({ error: 'Invalid reclamation ID' });
    }

    const { notes } = req.body;

    const reclamation = await storage.getReclamationById(reclamationId);

    if (!reclamation) {
      return res.status(404).json({ error: 'Reclamation not found' });
    }

    // Must be the assigned crew
    if (reclamation.currentCrewId !== workerInfo.crewId) {
      return res.status(403).json({ error: 'This reclamation is not assigned to your crew' });
    }

    // Check if reclamation is accepted
    if (reclamation.status !== 'accepted' && reclamation.status !== 'in_progress') {
      return res.status(400).json({
        error: 'Reclamation must be accepted before completing',
        currentStatus: reclamation.status
      });
    }

    // Complete the reclamation
    const updated = await storage.completeReclamation(reclamationId, notes?.trim());

    // Update project status back to work_completed
    await storage.updateProjectStatus(reclamation.projectId, 'work_completed');

    // Add project history entry
    await storage.createProjectHistoryEntry({
      projectId: reclamation.projectId,
      userId: req.user!.id,
      changeType: 'status_change',
      fieldName: 'status',
      oldValue: 'reclamation',
      newValue: 'work_completed',
      description: `Рекламация завершена${notes ? ': ' + notes.substring(0, 100) : ''}`,
    });

    res.json({
      success: true,
      reclamation: updated,
      message: 'Рекламация завершена успешно!',
    });
  } catch (error: any) {
    console.error('Error completing reclamation:', error);
    res.status(500).json({ error: 'Failed to complete reclamation' });
  }
});

/**
 * POST /api/worker/reclamations/:id/take
 * Take an available reclamation (rejected by another crew)
 */
router.post('/reclamations/:id/take', authenticateSupabase, requireWorker, async (req, res) => {
  try {
    const workerInfo = (req as any).workerInfo;
    const reclamationId = parseInt(req.params.id);

    if (isNaN(reclamationId)) {
      return res.status(400).json({ error: 'Invalid reclamation ID' });
    }

    const reclamation = await storage.getReclamationById(reclamationId);

    if (!reclamation) {
      return res.status(404).json({ error: 'Reclamation not found' });
    }

    // Must be rejected and not originally assigned to this crew
    if (reclamation.status !== 'rejected') {
      return res.status(400).json({ error: 'Only rejected reclamations can be taken' });
    }

    if (reclamation.currentCrewId === workerInfo.crewId) {
      return res.status(400).json({ error: 'This reclamation is already assigned to your crew' });
    }

    // Reassign to this crew and set status back to pending
    const updated = await storage.updateReclamation(reclamationId, {
      currentCrewId: workerInfo.crewId,
      status: 'pending',
    });

    // Add history entry
    await storage.addReclamationHistoryEntry({
      reclamationId,
      action: 'reassigned',
      actionByMember: workerInfo.crewMemberId,
      crewId: workerInfo.crewId,
      notes: `Бригада взяла рекламацию (ранее отклонённую)`,
    });

    res.json({
      success: true,
      reclamation: updated,
      message: 'Рекламация успешно взята вашей бригадой',
    });
  } catch (error: any) {
    console.error('Error taking reclamation:', error);
    res.status(500).json({ error: 'Failed to take reclamation' });
  }
});

export default router;
