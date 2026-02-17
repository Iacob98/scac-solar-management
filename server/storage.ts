import {
  profiles,
  firms,
  clients,
  crews,
  crewMembers,
  projects,
  services,
  invoices,
  projectFiles,
  projectReports,
  projectHistory,
  projectShares,
  userFirms,
  fileStorage,
  projectNotes,
  projectCrewSnapshots,
  crewHistory,
  reclamations,
  reclamationHistory,
  notifications,
  type User,
  type UpsertUser,
  type Firm,
  type InsertFirm,
  type Client,
  type InsertClient,
  type Crew,
  type InsertCrew,
  type CrewMember,
  type InsertCrewMember,
  type Project,
  type InsertProject,
  type Service,
  type InsertService,
  type Invoice,
  type InsertInvoice,
  type ProjectFile,
  type InsertProjectFile,
  type ProjectReport,
  type InsertProjectReport,
  type ProjectHistory,
  type InsertProjectHistory,
  type ProjectShare,
  type InsertProjectShare,
  type FileStorage,
  type InsertFileStorage,
  type ProjectCrewSnapshot,
  type InsertProjectCrewSnapshot,
  type CrewHistory,
  type InsertCrewHistory,
  type Reclamation,
  type InsertReclamation,
  type ReclamationHistory,
  type InsertReclamationHistory,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import crypto from 'crypto';
import path from 'path';

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(userId: string, profileData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  }>): Promise<User>;
  
  // Firm operations
  getFirms(): Promise<Firm[]>;
  getFirmById(id: string): Promise<Firm | undefined>;
  getFirmsByUserId(userId: string): Promise<Firm[]>;
  createFirm(firm: InsertFirm): Promise<Firm>;
  updateFirm(id: string, updates: Partial<InsertFirm>): Promise<Firm>;
  assignUserToFirm(userId: string, firmId: string): Promise<void>;
  removeUserFromFirm(userId: string, firmId: string): Promise<void>;
  getUsersByFirmId(firmId: string): Promise<User[]>;
  hasUserFirmAccess(userId: string, firmId: string): Promise<boolean>;
  
  // Client operations
  getClientsByFirmId(firmId: string): Promise<Client[]>;
  getClientById(id: number): Promise<Client | undefined>;
  getClientByNinjaId(firmId: string, ninjaClientId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: number): Promise<void>;

  // Crew operations
  getCrewsByFirmId(firmId: string): Promise<Crew[]>;
  getCrewById(id: number): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;
  updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew>;
  archiveCrew(id: number): Promise<void>;
  
  // Crew Member operations
  getCrewMembersByCrewId(crewId: number): Promise<CrewMember[]>;
  createCrewMember(member: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: number, member: Partial<InsertCrewMember>): Promise<CrewMember>;
  deleteCrewMember(id: number): Promise<void>;
  
  // Crew Statistics operations
  getProjectsByCrewId(crewId: number): Promise<Project[]>;
  getCrewStatistics(crewId: number, from: string, to: string): Promise<{
    metrics: {
      completedObjects: number;
      inProgress: number;
      avgDurationDays: number;
      overdueShare: number;
      reclamations: {
        total: number;
        pending: number;
        completed: number;
        rejected: number;
      };
    };
    charts: {
      completedByMonth: Array<{ month: string; count: number }>;
      avgDurationByMonth: Array<{ month: string; days: number }>;
    };
  }>;
  getCrewProjects(crewId: number, options: {
    from?: string;
    to?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<{
    total: number;
    page: number;
    size: number;
    items: Project[];
  }>;
  
  // Project operations
  getProjectsByFirmId(firmId: string): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project>;
  updateProjectStatus(id: number, status: string): Promise<Project>;
  
  // Service operations
  getServicesByProjectId(projectId: number): Promise<Service[]>;
  getServicesByProject(projectId: number): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: Partial<InsertService>): Promise<Service>;
  deleteService(id: number): Promise<void>;
  
  // Invoice operations
  getInvoicesByFirmId(firmId: string): Promise<Invoice[]>;
  getInvoiceByProjectId(projectId: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice>;
  
  // Additional methods
  getFirmById(firmId: string): Promise<Firm | undefined>;
  getProjectStats(firmId: string): Promise<any>;
  
  // File operations
  getFilesByProjectId(projectId: number): Promise<ProjectFile[]>;
  createFile(file: InsertProjectFile): Promise<ProjectFile>;
  getFileById(id: number): Promise<ProjectFile | undefined>;
  deleteFile(id: number): Promise<void>;
  
  // Report operations
  getReportsByProjectId(projectId: number): Promise<ProjectReport[]>;
  createReport(report: InsertProjectReport): Promise<ProjectReport>;
  getReportById(id: number): Promise<ProjectReport | undefined>;
  updateReport(id: number, report: Partial<InsertProjectReport>): Promise<ProjectReport>;
  deleteReport(id: number): Promise<void>;
  
  // Stats operations
  getProjectStats(firmId: string): Promise<{
    activeProjects: number;
    pendingInvoices: string;
    monthlyRevenue: string;
    activeCrews: number;
  }>;

  // Project History operations
  createProjectHistoryEntry(entry: InsertProjectHistory): Promise<ProjectHistory>;
  getProjectHistory(projectId: number): Promise<ProjectHistory[]>;
  shareProject(projectId: number, sharedBy: string, sharedWith: string, permission?: 'view' | 'edit'): Promise<ProjectShare>;
  getProjectShares(projectId: number): Promise<ProjectShare[]>;
  getUserSharedProjects(userId: string): Promise<number[]>;
  removeProjectShare(projectId: number, sharedWith: string): Promise<void>;
  getFirmUsers(firmId: string): Promise<User[]>;
  
  // Project Crew Snapshot operations
  createProjectCrewSnapshot(projectId: number, crewId: number, userId: string): Promise<ProjectCrewSnapshot>;
  getProjectCrewSnapshot(projectId: number): Promise<ProjectCrewSnapshot | undefined>;
  getCrewSnapshotById(id: number): Promise<ProjectCrewSnapshot | undefined>;
  
  // New File Storage operations
  createFileRecord(file: InsertFileStorage): Promise<FileStorage>;
  getFileRecord(fileId: string): Promise<FileStorage | undefined>;
  getProjectFiles(projectId: number): Promise<FileStorage[]>;
  deleteFileRecord(fileId: string): Promise<void>;
  hasProjectAccess(userId: string, projectId: number): Promise<boolean>;
  getFileStorageStats(): Promise<{ totalFiles: number; totalSize: number }>;
  addProjectHistory(entry: InsertProjectHistory): Promise<void>;

  // Crew history operations
  createCrewHistoryEntry(entry: InsertCrewHistory): Promise<CrewHistory>;
  getCrewHistory(crewId: number): Promise<CrewHistory[]>;
  logCrewMemberAdded(crewId: number, member: CrewMember, startDate: string, createdBy: string): Promise<void>;
  logCrewMemberRemoved(crewId: number, memberName: string, specialization: string, startDate: string, endDate: string, createdBy: string): Promise<void>;

  // Reclamation operations
  createReclamation(data: {
    projectId: number;
    firmId: number;
    description: string;
    deadline: string;
    crewId: number;
    createdBy: string;
  }): Promise<Reclamation>;
  getReclamationById(id: number): Promise<Reclamation | undefined>;
  getReclamationsByFirmId(firmId: number): Promise<Reclamation[]>;
  getReclamationsByProjectId(projectId: number): Promise<Reclamation[]>;
  getReclamationsForCrew(crewId: number): Promise<{
    assigned: Reclamation[];
    available: Reclamation[];
  }>;
  updateReclamation(id: number, updates: Partial<InsertReclamation>): Promise<Reclamation>;
  acceptReclamation(id: number, memberId: number): Promise<Reclamation>;
  rejectReclamation(id: number, memberId: number, reason: string): Promise<Reclamation>;
  completeReclamation(id: number, notes?: string): Promise<Reclamation>;
  cancelReclamation(id: number): Promise<Reclamation>;
  addReclamationHistoryEntry(entry: InsertReclamationHistory): Promise<ReclamationHistory>;
  getReclamationHistory(reclamationId: number): Promise<ReclamationHistory[]>;

  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  deleteNotification(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        profileImageUrl: profiles.profileImageUrl,
        role: profiles.role,
        crewMemberId: profiles.crewMemberId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .where(eq(profiles.id, id));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db
      .select({
        id: profiles.id,
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        profileImageUrl: profiles.profileImageUrl,
        role: profiles.role,
        crewMemberId: profiles.crewMemberId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(profiles)
      .values(userData)
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, profileData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    profileImageUrl: string;
  }>): Promise<User> {
    const updateData: any = { updatedAt: new Date() };
    if (profileData.firstName !== undefined) updateData.firstName = profileData.firstName;
    if (profileData.lastName !== undefined) updateData.lastName = profileData.lastName;
    if (profileData.email !== undefined) updateData.email = profileData.email;
    if (profileData.profileImageUrl !== undefined) updateData.profileImageUrl = profileData.profileImageUrl;

    const [updated] = await db
      .update(profiles)
      .set(updateData)
      .where(eq(profiles.id, userId))
      .returning();

    if (!updated) {
      throw new Error("User not found");
    }

    return updated;
  }

  // Firm operations
  async getFirms(): Promise<Firm[]> {
    return await db
      .select({
        id: firms.id,
        name: firms.name,
        invoiceNinjaUrl: firms.invoiceNinjaUrl,
        token: firms.token,
        address: firms.address,
        taxId: firms.taxId,
        logoUrl: firms.logoUrl,
        createdAt: firms.createdAt,
        postmarkServerToken: firms.postmarkServerToken,
        postmarkFromEmail: firms.postmarkFromEmail,
        postmarkMessageStream: firms.postmarkMessageStream,
        emailSubjectTemplate: firms.emailSubjectTemplate,
        emailBodyTemplate: firms.emailBodyTemplate,
      })
      .from(firms)
      .orderBy(desc(firms.createdAt));
  }

  async getFirmById(id: string): Promise<Firm | undefined> {
    const [firm] = await db
      .select({
        id: firms.id,
        name: firms.name,
        invoiceNinjaUrl: firms.invoiceNinjaUrl,
        token: firms.token,
        address: firms.address,
        taxId: firms.taxId,
        logoUrl: firms.logoUrl,
        createdAt: firms.createdAt,
        postmarkServerToken: firms.postmarkServerToken,
        postmarkFromEmail: firms.postmarkFromEmail,
        postmarkMessageStream: firms.postmarkMessageStream,
        emailSubjectTemplate: firms.emailSubjectTemplate,
        emailBodyTemplate: firms.emailBodyTemplate,
      })
      .from(firms)
      .where(eq(firms.id, id));
    return firm;
  }

  async getFirmsByUserId(userId: string): Promise<Firm[]> {
    return await db
      .select({
        id: firms.id,
        name: firms.name,
        invoiceNinjaUrl: firms.invoiceNinjaUrl,
        token: firms.token,
        address: firms.address,
        taxId: firms.taxId,
        logoUrl: firms.logoUrl,
        createdAt: firms.createdAt,
        postmarkServerToken: firms.postmarkServerToken,
        postmarkFromEmail: firms.postmarkFromEmail,
        postmarkMessageStream: firms.postmarkMessageStream,
        emailSubjectTemplate: firms.emailSubjectTemplate,
        emailBodyTemplate: firms.emailBodyTemplate,
      })
      .from(firms)
      .innerJoin(userFirms, eq(firms.id, userFirms.firmId))
      .where(eq(userFirms.userId, userId));
  }

  async createFirm(firm: InsertFirm): Promise<Firm> {
    const [newFirm] = await db.insert(firms).values(firm).returning();
    return newFirm;
  }

  async updateFirm(firmId: string, firmData: Partial<InsertFirm>): Promise<Firm> {
    const [updated] = await db
      .update(firms)
      .set(firmData)
      .where(eq(firms.id, firmId))
      .returning();
    
    if (!updated) {
      throw new Error("Firm not found");
    }
    
    return updated;
  }

  async assignUserToFirm(userId: string, firmId: string): Promise<void> {
    await db.insert(userFirms).values({ userId, firmId }).onConflictDoNothing();
  }

  async removeUserFromFirm(userId: string, firmId: string): Promise<void> {
    await db.delete(userFirms).where(and(
      eq(userFirms.userId, userId),
      eq(userFirms.firmId, firmId)
    ));
  }

  async getUsersByFirmId(firmId: string): Promise<User[]> {
    return await db
      .select({
        id: profiles.id,
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        profileImageUrl: profiles.profileImageUrl,
        role: profiles.role,
        crewMemberId: profiles.crewMemberId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .innerJoin(userFirms, eq(profiles.id, userFirms.userId))
      .where(eq(userFirms.firmId, firmId));
  }

  async hasUserFirmAccess(userId: string, firmId: string): Promise<boolean> {
    const [access] = await db
      .select({ userId: userFirms.userId })
      .from(userFirms)
      .where(and(eq(userFirms.userId, userId), eq(userFirms.firmId, firmId)))
      .limit(1);
    return !!access;
  }

  // Client operations
  async getClientsByFirmId(firmId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.firmId, firmId))
      .orderBy(desc(clients.createdAt));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async getClientById(id: number): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    return client;
  }

  async getClientByNinjaId(firmId: string, ninjaClientId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.firmId, firmId), eq(clients.ninjaClientId, ninjaClientId)));
    return client;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client> {
    const [updated] = await db
      .update(clients)
      .set(client)
      .where(eq(clients.id, id))
      .returning();
    return updated;
  }

  async deleteClient(id: number): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Crew operations
  async getCrewsByFirmId(firmId: string): Promise<Crew[]> {
    return await db
      .select()
      .from(crews)
      .where(eq(crews.firmId, firmId))
      .orderBy(desc(crews.createdAt));
  }

  async createCrew(crew: InsertCrew): Promise<Crew> {
    const [newCrew] = await db.insert(crews).values(crew).returning();
    return newCrew;
  }

  async getCrewById(id: number): Promise<Crew | undefined> {
    const [crew] = await db
      .select()
      .from(crews)
      .where(eq(crews.id, id));
    return crew;
  }

  async updateCrew(id: number, crew: Partial<InsertCrew>): Promise<Crew> {
    const [updated] = await db
      .update(crews)
      .set(crew)
      .where(eq(crews.id, id))
      .returning();
    return updated;
  }

  async archiveCrew(id: number): Promise<void> {
    await db.update(crews).set({ archived: true }).where(eq(crews.id, id));
  }

  async deleteCrew(id: number): Promise<void> {
    await db.delete(crews).where(eq(crews.id, id));
  }

  // Crew Member operations
  async getCrewMembersByCrewId(crewId: number): Promise<CrewMember[]> {
    return await db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.crewId, crewId))
      .orderBy(desc(crewMembers.createdAt));
  }

  async getCrewMemberById(id: number): Promise<CrewMember | undefined> {
    const [member] = await db
      .select()
      .from(crewMembers)
      .where(eq(crewMembers.id, id));
    return member || undefined;
  }

  async createCrewMember(member: InsertCrewMember): Promise<CrewMember> {
    const [newMember] = await db.insert(crewMembers).values(member).returning();
    return newMember;
  }

  async updateCrewMember(id: number, member: Partial<InsertCrewMember>): Promise<CrewMember> {
    const [updatedMember] = await db
      .update(crewMembers)
      .set(member)
      .where(eq(crewMembers.id, id))
      .returning();
    
    if (!updatedMember) {
      throw new Error("Crew member not found");
    }
    
    return updatedMember;
  }

  async deleteCrewMember(id: number): Promise<void> {
    await db.delete(crewMembers).where(eq(crewMembers.id, id));
  }

  // Crew Statistics operations
  async getProjectsByCrewId(crewId: number): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.crewId, crewId))
      .orderBy(desc(projects.createdAt));
  }

  async getCrewStatistics(crewId: number, from: string, to: string): Promise<{
    metrics: {
      completedObjects: number;
      inProgress: number;
      avgDurationDays: number;
      overdueShare: number;
      reclamations: {
        total: number;
        pending: number;
        completed: number;
        rejected: number;
      };
    };
    charts: {
      completedByMonth: Array<{ month: string; count: number }>;
      avgDurationByMonth: Array<{ month: string; days: number }>;
    };
  }> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    // Set toDate to end of day for proper timestamp comparison
    toDate.setHours(23, 59, 59, 999);

    // Get completed projects
    const completedProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.crewId, crewId),
          sql`${projects.status} IN ('work_completed', 'invoiced', 'paid')`,
          gte(projects.workEndDate, fromDate.toISOString().split('T')[0]),
          lte(projects.workEndDate, toDate.toISOString().split('T')[0])
        )
      );

    // Get currently active projects
    const activeProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.crewId, crewId),
          sql`${projects.status} IN ('work_scheduled', 'work_in_progress')`
        )
      );

    // Calculate average duration
    let totalDuration = 0;
    let projectsWithDuration = 0;
    
    for (const project of completedProjects) {
      if (project.workStartDate && project.workEndDate) {
        const startDate = new Date(project.workStartDate);
        const endDate = new Date(project.workEndDate);
        const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        totalDuration += duration;
        projectsWithDuration++;
      }
    }

    const avgDurationDays = projectsWithDuration > 0 ? totalDuration / projectsWithDuration : 0;

    // Calculate overdue projects (simplified - projects that took longer than expected)
    let overdueCount = 0;
    for (const project of completedProjects) {
      if (project.workStartDate && project.workEndDate && project.equipmentExpectedDate) {
        const expectedDate = new Date(project.equipmentExpectedDate);
        const actualEndDate = new Date(project.workEndDate);
        if (actualEndDate > expectedDate) {
          overdueCount++;
        }
      }
    }

    const overdueShare = completedProjects.length > 0 ? overdueCount / completedProjects.length : 0;

    // Get reclamations for this crew (as original or current crew)
    const crewReclamations = await db
      .select()
      .from(reclamations)
      .where(
        and(
          or(
            eq(reclamations.originalCrewId, crewId),
            eq(reclamations.currentCrewId, crewId)
          ),
          gte(reclamations.createdAt, fromDate),
          lte(reclamations.createdAt, toDate)
        )
      );

    const reclamationStats = {
      total: crewReclamations.length,
      pending: crewReclamations.filter(r => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress').length,
      completed: crewReclamations.filter(r => r.status === 'completed').length,
      rejected: crewReclamations.filter(r => r.status === 'rejected').length,
    };

    // Generate charts data
    const completedByMonth: Array<{ month: string; count: number }> = [];
    const avgDurationByMonth: Array<{ month: string; days: number }> = [];

    // Group completed projects by month
    const monthlyData = new Map<string, { count: number; totalDuration: number; projectsWithDuration: number }>();
    
    for (const project of completedProjects) {
      if (project.workEndDate) {
        const month = project.workEndDate.substring(0, 7); // YYYY-MM format
        
        if (!monthlyData.has(month)) {
          monthlyData.set(month, { count: 0, totalDuration: 0, projectsWithDuration: 0 });
        }
        
        const data = monthlyData.get(month)!;
        data.count++;
        
        if (project.workStartDate && project.workEndDate) {
          const startDate = new Date(project.workStartDate);
          const endDate = new Date(project.workEndDate);
          const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          data.totalDuration += duration;
          data.projectsWithDuration++;
        }
      }
    }

    // Convert to arrays
    for (const [month, data] of Array.from(monthlyData.entries())) {
      completedByMonth.push({ month, count: data.count });
      const avgDays = data.projectsWithDuration > 0 ? data.totalDuration / data.projectsWithDuration : 0;
      avgDurationByMonth.push({ month, days: Math.round(avgDays * 10) / 10 });
    }

    // Sort by month
    completedByMonth.sort((a, b) => a.month.localeCompare(b.month));
    avgDurationByMonth.sort((a, b) => a.month.localeCompare(b.month));

    return {
      metrics: {
        completedObjects: completedProjects.length,
        inProgress: activeProjects.length,
        avgDurationDays: Math.round(avgDurationDays * 10) / 10,
        overdueShare: Math.round(overdueShare * 100) / 100,
        reclamations: reclamationStats
      },
      charts: {
        completedByMonth,
        avgDurationByMonth
      }
    };
  }

  async getCrewProjects(crewId: number, options: {
    from?: string;
    to?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<{
    total: number;
    page: number;
    size: number;
    items: Project[];
  }> {
    const { from, to, status = 'all', page = 1, size = 50 } = options;
    
    let query = db.select().from(projects).where(eq(projects.crewId, crewId));
    
    const conditions = [eq(projects.crewId, crewId)];
    
    if (from && to) {
      conditions.push(
        gte(projects.workEndDate, from),
        lte(projects.workEndDate, to)
      );
    }
    
    if (status !== 'all') {
      if (status === 'completed') {
        conditions.push(sql`${projects.status} IN ('work_completed', 'invoiced', 'paid')`);
      } else {
        conditions.push(eq(projects.status, status as any));
      }
    }
    
    // Get total count
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(...conditions));
    
    const [{ count: total }] = await totalQuery;
    
    // Get paginated results
    const items = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt))
      .limit(size)
      .offset((page - 1) * size);
    
    return {
      total,
      page,
      size,
      items
    };
  }

  // Project operations
  async getProjectsByFirmId(firmId: string): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .where(eq(projects.firmId, firmId))
      .orderBy(desc(projects.createdAt));
  }



  async getProjectById(id: number): Promise<Project | undefined> {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async updateProjectStatus(id: number, status: string): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  // Service operations
  async getServicesByProjectId(projectId: number): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId))
      .orderBy(desc(services.createdAt));
  }

  async getServicesByProject(projectId: number): Promise<Service[]> {
    return this.getServicesByProjectId(projectId);
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: number, service: Partial<InsertService>): Promise<Service> {
    const [updated] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    return updated;
  }

  async getServiceById(id: number): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, id));
    return service;
  }

  async deleteService(id: number): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Invoice operations
  async getInvoicesByFirmId(firmId: string): Promise<Invoice[]> {
    return await db
      .select({
        id: invoices.id,
        projectId: invoices.projectId,
        invoiceId: invoices.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        totalAmount: invoices.totalAmount,
        isPaid: invoices.isPaid,
        status: invoices.status, // ДОБАВЛЯЕМ ПОЛЕ STATUS!
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(eq(projects.firmId, firmId))
      .orderBy(desc(invoices.createdAt));
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    return newInvoice;
  }

  async updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice> {
    const [updated] = await db
      .update(invoices)
      .set(invoice)
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getInvoiceByProjectId(projectId: number): Promise<Invoice | undefined> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.projectId, projectId));
    return invoice;
  }



  // File operations
  async getFilesByProjectId(projectId: number): Promise<ProjectFile[]> {
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId))
      .orderBy(desc(projectFiles.uploadedAt));
    
    // Исправляем URL для всех файлов - используем API вместо прямых ссылок
    return files.map(file => ({
      ...file,
      fileUrl: `/api/files/${file.id}` // Всегда используем API URL
    }));
  }

  async createFile(file: InsertProjectFile): Promise<ProjectFile> {
    const [newFile] = await db.insert(projectFiles).values(file).returning();
    return newFile;
  }

  async getFileById(id: number): Promise<ProjectFile | undefined> {
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.id, id));
    return file || undefined;
  }

  async deleteFile(id: number): Promise<void> {
    await db.delete(projectFiles).where(eq(projectFiles.id, id));
  }

  // Report operations
  async getReportsByProjectId(projectId: number): Promise<ProjectReport[]> {
    return await db
      .select()
      .from(projectReports)
      .where(eq(projectReports.projectId, projectId))
      .orderBy(desc(projectReports.createdAt));
  }

  async createReport(report: InsertProjectReport): Promise<ProjectReport> {
    const [newReport] = await db.insert(projectReports).values(report).returning();
    return newReport;
  }

  async getReportById(id: number): Promise<ProjectReport | undefined> {
    const [report] = await db
      .select()
      .from(projectReports)
      .where(eq(projectReports.id, id));
    return report || undefined;
  }

  async updateReport(id: number, report: Partial<InsertProjectReport>): Promise<ProjectReport> {
    const [updated] = await db
      .update(projectReports)
      .set(report)
      .where(eq(projectReports.id, id))
      .returning();
    
    if (!updated) {
      throw new Error("Report not found");
    }
    
    return updated;
  }

  async deleteReport(id: number): Promise<void> {
    await db.delete(projectReports).where(eq(projectReports.id, id));
  }

  // Stats operations
  async getProjectStats(firmId: string): Promise<{
    activeProjects: number;
    pendingInvoices: string;
    monthlyRevenue: string;
    activeCrews: number;
  }> {
    const [activeProjectsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(projects.status, "work_in_progress" as any)
        )
      );

    const [pendingInvoicesResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(invoices.isPaid, false)
        )
      );

    const [monthlyRevenueResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)` })
      .from(invoices)
      .innerJoin(projects, eq(invoices.projectId, projects.id))
      .where(
        and(
          eq(projects.firmId, firmId),
          eq(invoices.isPaid, true),
          sql`${invoices.createdAt} >= date_trunc('month', current_date)`
        )
      );

    const [activeCrewsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(crews)
      .where(
        and(
          eq(crews.firmId, firmId),
          eq(crews.archived, false)
        )
      );

    return {
      activeProjects: activeProjectsResult.count,
      pendingInvoices: pendingInvoicesResult.total,
      monthlyRevenue: monthlyRevenueResult.total,
      activeCrews: activeCrewsResult.count,
    };
  }

  // Project History operations
  async createProjectHistoryEntry(entry: InsertProjectHistory): Promise<ProjectHistory> {
    const [historyEntry] = await db
      .insert(projectHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }

  async getProjectHistory(projectId: number): Promise<ProjectHistory[]> {
    return await db
      .selectDistinctOn([projectHistory.id], {
        id: projectHistory.id,
        projectId: projectHistory.projectId,
        userId: projectHistory.userId,
        changeType: projectHistory.changeType,
        fieldName: projectHistory.fieldName,
        oldValue: projectHistory.oldValue,
        newValue: projectHistory.newValue,
        description: projectHistory.description,
        crewSnapshotId: projectHistory.crewSnapshotId,
        createdAt: projectHistory.createdAt,
        userFirstName: profiles.firstName,
        userLastName: profiles.lastName,
        userEmail: profiles.email,
        userProfileImageUrl: profiles.profileImageUrl,
        // Добавляем приоритет примечания для записей типа note_added
        notePriority: projectNotes.priority,
      })
      .from(projectHistory)
      .leftJoin(profiles, eq(projectHistory.userId, profiles.id))
      .leftJoin(
        projectNotes,
        and(
          eq(projectHistory.changeType, 'note_added'),
          eq(projectNotes.projectId, projectHistory.projectId),
          eq(projectNotes.userId, projectHistory.userId),
          // Ищем примечание, созданное в то же время (плюс-минус несколько секунд)
          gte(projectNotes.createdAt, sql`${projectHistory.createdAt} - interval '5 seconds'`),
          lte(projectNotes.createdAt, sql`${projectHistory.createdAt} + interval '5 seconds'`)
        )
      )
      .where(eq(projectHistory.projectId, projectId))
      .orderBy(projectHistory.id, desc(projectHistory.createdAt));
  }

  // Project Sharing operations
  async shareProject(projectId: number, sharedBy: string, sharedWith: string, permission: 'view' | 'edit' = 'view'): Promise<ProjectShare> {
    const [share] = await db
      .insert(projectShares)
      .values({
        projectId,
        sharedBy,
        sharedWith,
        permission,
      })
      .returning();
    return share;
  }

  async getProjectShares(projectId: number): Promise<ProjectShare[]> {
    return await db
      .select()
      .from(projectShares)
      .where(eq(projectShares.projectId, projectId));
  }

  async getUserSharedProjects(userId: string): Promise<number[]> {
    const shares = await db
      .select({ projectId: projectShares.projectId })
      .from(projectShares)
      .where(eq(projectShares.sharedWith, userId));
    return shares.map(share => share.projectId);
  }

  async removeProjectShare(projectId: number, sharedWith: string): Promise<void> {
    await db
      .delete(projectShares)
      .where(
        and(
          eq(projectShares.projectId, projectId),
          eq(projectShares.sharedWith, sharedWith)
        )
      );
  }

  async getFirmUsers(firmId: string): Promise<User[]> {
    return await db
      .select({
        id: profiles.id,
        email: profiles.email,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        profileImageUrl: profiles.profileImageUrl,
        role: profiles.role,
        crewMemberId: profiles.crewMemberId,
        createdAt: profiles.createdAt,
        updatedAt: profiles.updatedAt,
      })
      .from(profiles)
      .innerJoin(userFirms, eq(profiles.id, userFirms.userId))
      .where(eq(userFirms.firmId, firmId));
  }

  // Project Crew Snapshot operations
  async createProjectCrewSnapshot(projectId: number, crewId: number, userId: string): Promise<ProjectCrewSnapshot> {
    // Получаем информацию о бригаде
    const crew = await this.getCrewById(crewId);
    if (!crew) {
      throw new Error('Crew not found');
    }

    // Получаем всех членов бригады
    const members = await this.getCrewMembersByCrewId(crewId);

    // Создаем снимок с полной информацией о бригаде и ее составе
    const [snapshot] = await db
      .insert(projectCrewSnapshots)
      .values({
        projectId,
        crewId,
        crewData: {
          id: crew.id,
          firmId: crew.firmId,
          name: crew.name,
          uniqueNumber: crew.uniqueNumber,
          leaderName: crew.leaderName,
          phone: crew.phone,
          address: crew.address,
          status: crew.status,
        },
        membersData: members.map(member => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          address: member.address,
          uniqueNumber: member.uniqueNumber,
          phone: member.phone,
          role: member.role,
          memberEmail: member.memberEmail,
        })),
        createdBy: userId,
      })
      .returning();

    return snapshot;
  }

  async getProjectCrewSnapshot(projectId: number): Promise<ProjectCrewSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(projectCrewSnapshots)
      .where(eq(projectCrewSnapshots.projectId, projectId))
      .orderBy(desc(projectCrewSnapshots.snapshotDate))
      .limit(1);
    
    return snapshot;
  }

  async getCrewSnapshotById(snapshotId: number): Promise<ProjectCrewSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(projectCrewSnapshots)
      .where(eq(projectCrewSnapshots.id, snapshotId));
    
    return snapshot;
  }

  // New File Storage methods
  async createFileRecord(file: InsertFileStorage): Promise<FileStorage> {
    const [fileRecord] = await db
      .insert(fileStorage)
      .values(file)
      .returning();
    return fileRecord;
  }

  async getFileRecord(fileId: string): Promise<FileStorage | undefined> {
    const [file] = await db
      .select()
      .from(fileStorage)
      .where(eq(fileStorage.fileId, fileId));
    return file;
  }

  async getProjectFiles(projectId: number): Promise<FileStorage[]> {
    return await db
      .select()
      .from(fileStorage)
      .where(
        and(
          eq(fileStorage.projectId, projectId),
          eq(fileStorage.isDeleted, false)
        )
      )
      .orderBy(desc(fileStorage.uploadedAt));
  }

  async deleteFileRecord(fileId: string): Promise<void> {
    await db
      .update(fileStorage)
      .set({
        isDeleted: true,
        deletedAt: new Date()
      })
      .where(eq(fileStorage.fileId, fileId));
  }

  async hasProjectAccess(userId: string, projectId: number): Promise<boolean> {
    // Админы имеют доступ ко всем проектам
    const user = await this.getUser(userId);
    if (user?.role === 'admin') {
      return true;
    }

    // Проверяем, является ли пользователь лейтером проекта
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return false;
    }

    if (project.leiterId === userId) {
      return true;
    }

    // Проверяем, является ли пользователь worker из бригады проекта
    if (user?.role === 'worker' && user.crew_member_id && project.crewId) {
      const [crewMember] = await db
        .select({ crewId: crewMembers.crewId })
        .from(crewMembers)
        .where(eq(crewMembers.id, user.crew_member_id));

      if (crewMember && crewMember.crewId === project.crewId) {
        return true;
      }
    }

    // Проверяем, есть ли общий доступ к проекту
    const [sharedProject] = await db
      .select()
      .from(projectShares)
      .where(
        and(
          eq(projectShares.projectId, projectId),
          eq(projectShares.sharedWith, userId)
        )
      );

    return !!sharedProject;
  }

  async getFileStorageStats(): Promise<{ totalFiles: number; totalSize: number }> {
    const stats = await db
      .select({
        totalFiles: sql<number>`count(*)::int`,
        totalSize: sql<number>`sum(${fileStorage.size})::int`
      })
      .from(fileStorage)
      .where(eq(fileStorage.isDeleted, false));

    return stats[0] || { totalFiles: 0, totalSize: 0 };
  }

  async addProjectHistory(entry: InsertProjectHistory): Promise<void> {
    await db
      .insert(projectHistory)
      .values(entry);
  }

  // Crew Upload Token methods
  async generateCrewUploadToken(projectId: number): Promise<string> {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await db
      .update(projects)
      .set({
        crewUploadToken: token,
        crewUploadTokenExpires: expiresAt,
      })
      .where(eq(projects.id, projectId));

    return token;
  }

  async validateCrewUploadToken(projectId: number, token: string): Promise<{ valid: boolean; project?: any; crew?: any }> {
    const [project] = await db
      .select({
        id: projects.id,
        firmId: projects.firmId,
        crewId: projects.crewId,
        crewUploadToken: projects.crewUploadToken,
        crewUploadTokenExpires: projects.crewUploadTokenExpires,
        installationPersonFirstName: projects.installationPersonFirstName,
        installationPersonLastName: projects.installationPersonLastName,
        installationPersonAddress: projects.installationPersonAddress,
      })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project || project.crewUploadToken !== token) {
      return { valid: false };
    }

    if (!project.crewUploadTokenExpires || new Date() > project.crewUploadTokenExpires) {
      return { valid: false };
    }

    let crew = null;
    if (project.crewId) {
      [crew] = await db
        .select()
        .from(crews)
        .where(eq(crews.id, project.crewId));
    }

    return { valid: true, project, crew };
  }

  async validateCrewMemberEmail(crewId: number, email: string): Promise<boolean> {
    const [member] = await db
      .select()
      .from(crewMembers)
      .where(
        and(
          eq(crewMembers.crewId, crewId),
          eq(crewMembers.memberEmail, email)
        )
      );

    return !!member;
  }

  // Crew history operations
  async createCrewHistoryEntry(entry: InsertCrewHistory): Promise<CrewHistory> {
    const [result] = await db.insert(crewHistory).values(entry).returning();
    return result;
  }

  async getCrewHistory(crewId: number): Promise<CrewHistory[]> {
    return await db
      .select()
      .from(crewHistory)
      .where(eq(crewHistory.crewId, crewId))
      .orderBy(desc(crewHistory.createdAt));
  }

  async logCrewMemberAdded(crewId: number, member: CrewMember, startDate: string, createdBy: string): Promise<void> {
    await this.createCrewHistoryEntry({
      crewId,
      changeType: 'member_added',
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      memberSpecialization: member.role,
      startDate,
      changeDescription: `Участник ${member.firstName} ${member.lastName} добавлен в бригаду`,
      createdBy,
    });
  }

  async logCrewMemberRemoved(crewId: number, memberName: string, specialization: string, startDate: string, endDate: string, createdBy: string): Promise<void> {
    await this.createCrewHistoryEntry({
      crewId,
      changeType: 'member_removed',
      memberName,
      memberSpecialization: specialization,
      startDate,
      endDate,
      changeDescription: `Участник ${memberName} исключен из бригады (работал с ${startDate} по ${endDate})`,
      createdBy,
    });
  }

  // Reclamation operations
  async createReclamation(data: {
    projectId: number;
    firmId: number;
    description: string;
    deadline: string;
    crewId: number;
    createdBy: string;
  }): Promise<Reclamation> {
    const [reclamation] = await db
      .insert(reclamations)
      .values({
        projectId: data.projectId,
        firmId: data.firmId,
        description: data.description,
        deadline: data.deadline,
        status: 'pending',
        originalCrewId: data.crewId,
        currentCrewId: data.crewId,
        createdBy: data.createdBy,
      })
      .returning();

    // Add history entry
    await this.addReclamationHistoryEntry({
      reclamationId: reclamation.id,
      action: 'created',
      actionBy: data.createdBy,
      crewId: data.crewId,
      notes: data.description,
    });

    return reclamation;
  }

  async getReclamationById(id: number): Promise<Reclamation | undefined> {
    const [reclamation] = await db
      .select()
      .from(reclamations)
      .where(eq(reclamations.id, id));
    return reclamation;
  }

  async getReclamationsByFirmId(firmId: number): Promise<Reclamation[]> {
    return await db
      .select()
      .from(reclamations)
      .where(eq(reclamations.firmId, firmId))
      .orderBy(desc(reclamations.createdAt));
  }

  async getReclamationsByProjectId(projectId: number): Promise<Reclamation[]> {
    return await db
      .select()
      .from(reclamations)
      .where(eq(reclamations.projectId, projectId))
      .orderBy(desc(reclamations.createdAt));
  }

  async getReclamationsForCrew(crewId: number): Promise<{
    assigned: Reclamation[];
    available: Reclamation[];
  }> {
    // Рекламации, назначенные этой бригаде и ожидающие ответа
    const assigned = await db
      .select()
      .from(reclamations)
      .where(
        and(
          eq(reclamations.currentCrewId, crewId),
          eq(reclamations.status, 'pending')
        )
      )
      .orderBy(desc(reclamations.createdAt));

    // Рекламации, отклонённые оригинальной бригадой - доступны для взятия
    const available = await db
      .select()
      .from(reclamations)
      .where(
        and(
          eq(reclamations.status, 'rejected'),
          sql`${reclamations.originalCrewId} != ${crewId}` // не наша оригинальная
        )
      )
      .orderBy(desc(reclamations.createdAt));

    return { assigned, available };
  }

  async updateReclamation(id: number, updates: Partial<InsertReclamation>): Promise<Reclamation> {
    const [updated] = await db
      .update(reclamations)
      .set(updates)
      .where(eq(reclamations.id, id))
      .returning();
    return updated;
  }

  async acceptReclamation(id: number, memberId: number): Promise<Reclamation> {
    const [updated] = await db
      .update(reclamations)
      .set({
        status: 'accepted',
        acceptedBy: memberId,
        acceptedAt: new Date(),
      })
      .where(eq(reclamations.id, id))
      .returning();

    // Add history entry
    await this.addReclamationHistoryEntry({
      reclamationId: id,
      action: 'accepted',
      actionByMember: memberId,
      crewId: updated.currentCrewId,
    });

    return updated;
  }

  async rejectReclamation(id: number, memberId: number, reason: string): Promise<Reclamation> {
    const [updated] = await db
      .update(reclamations)
      .set({
        status: 'rejected',
      })
      .where(eq(reclamations.id, id))
      .returning();

    // Add history entry
    await this.addReclamationHistoryEntry({
      reclamationId: id,
      action: 'rejected',
      actionByMember: memberId,
      crewId: updated.currentCrewId,
      reason: reason,
    });

    return updated;
  }

  async completeReclamation(id: number, notes?: string): Promise<Reclamation> {
    const [updated] = await db
      .update(reclamations)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedNotes: notes,
      })
      .where(eq(reclamations.id, id))
      .returning();

    // Add history entry
    await this.addReclamationHistoryEntry({
      reclamationId: id,
      action: 'completed',
      crewId: updated.currentCrewId,
      notes: notes,
    });

    return updated;
  }

  async cancelReclamation(id: number): Promise<Reclamation> {
    const [updated] = await db
      .update(reclamations)
      .set({
        status: 'cancelled',
      })
      .where(eq(reclamations.id, id))
      .returning();

    // Add history entry
    await this.addReclamationHistoryEntry({
      reclamationId: id,
      action: 'cancelled',
    });

    return updated;
  }

  async addReclamationHistoryEntry(entry: InsertReclamationHistory): Promise<ReclamationHistory> {
    const [historyEntry] = await db
      .insert(reclamationHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }

  async getReclamationHistory(reclamationId: number): Promise<ReclamationHistory[]> {
    return await db
      .select()
      .from(reclamationHistory)
      .where(eq(reclamationHistory.reclamationId, reclamationId))
      .orderBy(desc(reclamationHistory.createdAt));
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        projectId: notifications.projectId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        link: notifications.link,
        isRead: notifications.isRead,
        sourceUserId: notifications.sourceUserId,
        createdAt: notifications.createdAt,
        // Добавляем информацию об отправителе
        sourceUserFirstName: profiles.firstName,
        sourceUserLastName: profiles.lastName,
        sourceUserProfileImage: profiles.profileImageUrl,
      })
      .from(notifications)
      .leftJoin(profiles, eq(notifications.sourceUserId, profiles.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async markNotificationRead(id: number): Promise<Notification> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false)
        )
      );
    return result?.count || 0;
  }

  async deleteNotification(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }
}

export const storage = new DatabaseStorage();
