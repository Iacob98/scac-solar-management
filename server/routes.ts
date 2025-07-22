import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { InvoiceNinjaService } from "./services/invoiceNinja";
import { db } from "./db";
import { projects, projectHistory, projectNotes } from "@shared/schema";
import { eq } from "drizzle-orm";
import { 
  insertFirmSchema, 
  insertClientSchema, 
  insertCrewSchema, 
  insertCrewMemberSchema,
  insertProjectSchema, 
  insertServiceSchema,
  insertProjectFileSchema,
  insertProjectReportSchema,
  insertProjectNoteSchema
} from "@shared/schema";
import { z } from "zod";
import fileRoutes from "./routes/fileRoutes";
import googleCalendarRoutes from "./routes/googleCalendar";
import emailNotificationRoutes from "./routes/emailNotifications";
import calendarDemoRoutes from "./routes/calendarDemo";
import googleRoutes from "./routes/google";
import { fileStorageService } from "./storage/fileStorage";
import { emailNotificationService } from "./services/emailNotifications";
import { googleCalendarService } from "./services/googleCalendar";

// Admin role check middleware
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  } catch (error) {
    console.error("Error in isAdmin middleware:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Helper function to build German installation notes
function buildInstallationNotesGerman(installationPerson: any, project: any): string {
  const notes = ['Installationsdetails:'];
  
  if (installationPerson.firstName || installationPerson.lastName) {
    const fullName = [installationPerson.firstName, installationPerson.lastName].filter(Boolean).join(' ');
    notes.push(`Name: ${fullName}`);
  }
  
  if (installationPerson.address) {
    notes.push(`Adresse: ${installationPerson.address}`);
  }
  
  if (installationPerson.uniqueId) {
    notes.push(`Kunden-ID: ${installationPerson.uniqueId}`);
  }
  
  if (installationPerson.phone) {
    notes.push(`Telefon: ${installationPerson.phone}`);
  }
  
  if (project.notes) {
    notes.push('', 'Zusätzliche Hinweise:');
    notes.push(project.notes);
  }
  
  return notes.join('\n');
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  // File storage routes
  app.use('/api/files', fileRoutes);
  
  // Google Calendar routes
  app.use('/api/google-calendar', googleCalendarRoutes);
  app.use('/api/google', googleRoutes);
  
  // Email notification routes
  app.use('/api/notifications', emailNotificationRoutes);
  app.use('/api/calendar-demo', calendarDemoRoutes);

  // Test endpoint for history entries
  app.get('/api/test-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = await storage.createProjectHistoryEntry({
        projectId: 16,
        userId,
        changeType: 'info_update',
        fieldName: 'test',
        oldValue: null,
        newValue: 'test',
        description: 'Тестовая запись в историю',
      });
      res.json({ success: true, historyId: result.id });
    } catch (error) {
      console.error('Test history error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Development test users login
  app.post('/api/auth/test-login', async (req, res) => {
    try {
      const { userId } = z.object({
        userId: z.string(),
      }).parse(req.body);

      // Check if user exists in our system
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Test user not found" });
      }

      // Set session
      if (req.session) {
        req.session.userId = userId;
        req.session.user = {
          claims: {
            sub: userId,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`.trim(),
          }
        };
        
        // Force session save
        req.session.save();
      }

      res.json({ success: true, user });
    } catch (error) {
      console.error("Error in test login:", error);
      res.status(500).json({ message: "Test login failed" });
    }
  });

  // Get available test users
  app.get('/api/auth/test-users', async (req, res) => {
    try {
      const testUsers = [
        { id: '41352215', name: 'Iacob Bujac', email: 'iasabujac@gmail.com', role: 'admin' },
        { id: 'test_user_1', name: 'Maria Schneider', email: 'maria.schneider@solar.de', role: 'leiter' },
        { id: 'test_user_2', name: 'Thomas Mueller', email: 'thomas.mueller@solar.de', role: 'leiter' },
        { id: 'test_user_3', name: 'Anna Weber', email: 'anna.weber@solar.de', role: 'leiter' },
        { id: 'test_user_4', name: 'Klaus Richter', email: 'klaus.richter@greenenergy.de', role: 'leiter' },
        { id: 'test_user_5', name: 'Petra Wagner', email: 'petra.wagner@solarpower.de', role: 'leiter' },
        { id: 'test_user_new_firm', name: 'Test Manager', email: 'manager@testsolar.de', role: 'leiter' },
      ];
      res.json(testUsers);
    } catch (error) {
      console.error("Error fetching test users:", error);
      res.status(500).json({ message: "Failed to fetch test users" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch('/api/auth/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        profileImageUrl: z.string().url().optional().or(z.literal('')),
      }).parse(req.body);

      const updatedUser = await storage.updateUserProfile(userId, profileData);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.patch('/api/auth/password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const passwordData = z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(8),
      }).parse(req.body);

      // Note: This is a placeholder - password changes should be handled by Replit Auth
      res.status(501).json({ message: "Password changes are handled by Replit Auth" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });



  app.patch('/api/invoice/mark-paid', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { invoiceNumber } = z.object({
        invoiceNumber: z.string(),
      }).parse(req.body);

      // Find invoice in our database across all accessible firms
      let invoice;
      let firm;
      const userFirms = await storage.getFirmsByUserId(userId);
      
      for (const userFirm of userFirms) {
        const firmInvoices = await storage.getInvoicesByFirmId(userFirm.id);
        const foundInvoice = firmInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
        if (foundInvoice) {
          invoice = foundInvoice;
          firm = userFirm;
          break;
        }
      }
      
      if (!invoice || !firm) {
        return res.status(404).json({ message: "Invoice not found or access denied" });
      }

      // Mark invoice as paid in Invoice Ninja first
      try {
        const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
        await invoiceNinja.markInvoiceAsPaid(invoice.invoiceId);
        console.log(`Successfully marked invoice ${invoice.invoiceId} as paid in Invoice Ninja`);
      } catch (ninjaError) {
        console.error("Failed to mark invoice as paid in Invoice Ninja:", ninjaError);
        // Continue with local update even if Invoice Ninja fails
      }

      // Update invoice as paid in our database
      await storage.updateInvoice(invoice.id, { isPaid: true });

      // Update project status to paid
      await storage.updateProject(invoice.projectId, { status: 'paid' });

      // Add history entry
      console.log(`Adding payment history entry for project ${invoice.projectId}, invoice ${invoiceNumber}`);
      await storage.createProjectHistoryEntry({
        projectId: invoice.projectId,
        userId,
        changeType: 'status_change',
        fieldName: 'status',
        oldValue: 'invoiced',
        newValue: 'paid',
        description: `Счет №${invoiceNumber} помечен как оплаченный`,
      });
      console.log(`Successfully added payment history entry`);

      res.json({ success: true, message: "Invoice marked as paid" });

    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  app.get('/api/catalog/products/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      
      const firms = await storage.getFirms();
      const firm = firms.find(f => f.id === firmId);
      
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      const ninjaService = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
      const products = await ninjaService.getProducts();
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Global products endpoint using environment variables
  app.get('/api/catalog/products', isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.INVOICE_NINJA_API_KEY;
      const baseUrl = process.env.INVOICE_NINJA_URL;
      
      console.log('API credentials:', { apiKey: apiKey ? 'exists' : 'missing', baseUrl });
      
      if (!apiKey || !baseUrl) {
        return res.status(500).json({ message: "Invoice Ninja API credentials not configured" });
      }

      const ninjaService = new InvoiceNinjaService(baseUrl, apiKey);
      const products = await ninjaService.getProducts();
      
      console.log('Raw products from Invoice Ninja:', products.length);
      
      // Transform products to match our expected format
      const transformedProducts = products.map(product => ({
        id: product.id,
        name: product.product_key,
        description: product.notes,
        price: product.price,
        cost: product.cost,
        taxRate: product.tax_rate1,
        category: product.custom_value1 || 'Услуги',
        unit: product.custom_value2 || product.custom_value1 || 'шт'
      }));
      
      console.log('Transformed products:', transformedProducts.length);
      
      res.json(transformedProducts);
    } catch (error) {
      console.error("Error fetching products from Invoice Ninja:", error);
      res.status(500).json({ message: "Failed to fetch products from Invoice Ninja" });
    }
  });

  // Firm routes
  app.get('/api/firms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let firms;
      if (user.role === 'admin') {
        firms = await storage.getFirms();
      } else {
        firms = await storage.getFirmsByUserId(userId);
      }
      
      res.json(firms);
    } catch (error) {
      console.error("Error fetching firms:", error);
      res.status(500).json({ message: "Failed to fetch firms" });
    }
  });

  app.post('/api/firms/test-connection', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { invoiceNinjaUrl, token } = req.body;
      
      if (!invoiceNinjaUrl || !token) {
        return res.status(400).json({ message: "URL and API token are required" });
      }

      const ninjaService = new InvoiceNinjaService(invoiceNinjaUrl, token);
      const companyInfo = await ninjaService.getCompanyInfo();
      
      res.json({
        success: true,
        companyInfo,
      });
    } catch (error: any) {
      console.error("Error testing Invoice Ninja connection:", error);
      res.status(400).json({ 
        success: false,
        message: error.message || "Failed to connect to Invoice Ninja" 
      });
    }
  });

  app.post('/api/firms', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const firmData = insertFirmSchema.parse(req.body);
      const firm = await storage.createFirm(firmData);
      res.json(firm);
    } catch (error) {
      console.error("Error creating firm:", error);
      res.status(500).json({ message: "Failed to create firm" });
    }
  });

  // Client routes - sync with Invoice Ninja
  app.get('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      // Get firm info to access Invoice Ninja
      const firm = await storage.getFirmById(firmId);
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      try {
        // Get clients from Invoice Ninja
        const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
        const ninjaClients = await invoiceNinja.getClients();
        
        // Sync with local database
        for (const ninjaClient of ninjaClients) {
          const existingClient = await storage.getClientByNinjaId(firmId, ninjaClient.id);
          if (!existingClient) {
            // Create new client in local database
            await storage.createClient({
              firmId,
              ninjaClientId: ninjaClient.id,
              name: ninjaClient.name,
              email: ninjaClient.email || null,
              phone: ninjaClient.phone || null,
              address: ninjaClient.address1 ? `${ninjaClient.address1}, ${ninjaClient.city || ''}, ${ninjaClient.postal_code || ''}`.trim() : null,
            });
          }
        }
      } catch (ninjaError) {
        console.warn("Warning: Could not sync with Invoice Ninja, using local clients only:", ninjaError);
      }
      
      // Return all local clients for this firm
      const clients = await storage.getClientsByFirmId(firmId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get('/api/clients/single/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log('Fetching client with ID:', id);
      const client = await storage.getClientById(Number(id));
      console.log('Client from database:', client);
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      
      // Get firm info to access Invoice Ninja
      const firm = await storage.getFirmById(clientData.firmId);
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      try {
        // Create client in Invoice Ninja first
        const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
        
        // Parse address for Invoice Ninja
        const addressParts = clientData.address ? clientData.address.split(',').map(part => part.trim()) : [];
        const ninjaClientData = {
          name: clientData.name,
          email: clientData.email || '',
          phone: clientData.phone || '',
          address1: addressParts[0] || '',
          city: addressParts[1] || '',
          postal_code: addressParts[2] || '',
          country_id: '276', // Germany
        };

        const ninjaClient = await invoiceNinja.createClient(ninjaClientData);
        
        // Create client in local database with Invoice Ninja ID
        const client = await storage.createClient({
          ...clientData,
          ninjaClientId: ninjaClient.id,
        });
        
        res.json(client);
      } catch (ninjaError) {
        console.warn("Warning: Could not create client in Invoice Ninja, creating locally only:", ninjaError);
        // Fallback: create only in local database
        const client = await storage.createClient(clientData);
        res.json(client);
      }
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Crew routes
  app.get('/api/crews', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const allCrews = await storage.getCrewsByFirmId(firmId);
      
      // Filter crews based on user access rights
      let accessibleCrews: any[] = [];
      
      if (user.role === 'admin') {
        // Admins see all crews
        accessibleCrews = allCrews;
      } else {
        // Non-admin users see only crews assigned to their projects or shared projects
        const userProjects = await storage.getProjectsByFirmId(firmId);
        const accessibleProjectIds = new Set<number>();
        
        // Get projects user has access to
        for (const project of userProjects) {
          if (project.leiterId === userId) {
            accessibleProjectIds.add(project.id);
          } else {
            const shares = await storage.getProjectShares(project.id);
            const hasAccess = shares.some(share => share.sharedWith === userId);
            if (hasAccess) {
              accessibleProjectIds.add(project.id);
            }
          }
        }
        
        // Get crew IDs from accessible projects
        const accessibleCrewIds = new Set<number>();
        for (const project of userProjects) {
          if (accessibleProjectIds.has(project.id) && project.crewId) {
            accessibleCrewIds.add(project.crewId);
          }
        }
        
        // Filter crews
        accessibleCrews = allCrews.filter(crew => accessibleCrewIds.has(crew.id));
      }
      
      res.json(accessibleCrews);
    } catch (error) {
      console.error("Error fetching crews:", error);
      res.status(500).json({ message: "Failed to fetch crews" });
    }
  });

  app.get('/api/crews/single/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log('Fetching crew with ID:', id);
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const crew = await storage.getCrewById(Number(id));
      console.log('Crew from database:', crew);
      
      if (!crew) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      // Check access permissions
      let hasAccess = false;
      
      if (user.role === 'admin') {
        hasAccess = true;
      } else {
        // Check if crew is used in any projects user has access to
        const firmProjects = await storage.getProjectsByFirmId(crew.firmId);
        
        for (const project of firmProjects) {
          if (project.crewId === crew.id) {
            // Check if user has access to this project
            if (project.leiterId === userId) {
              hasAccess = true;
              break;
            } else {
              const shares = await storage.getProjectShares(project.id);
              const projectHasAccess = shares.some(share => share.sharedWith === userId);
              if (projectHasAccess) {
                hasAccess = true;
                break;
              }
            }
          }
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this crew" });
      }
      
      res.json(crew);
    } catch (error) {
      console.error("Error fetching crew:", error);
      res.status(500).json({ message: "Failed to fetch crew" });
    }
  });

  app.post('/api/crews', isAuthenticated, async (req: any, res) => {
    try {
      const { members, ...crewData } = req.body;
      
      // Validate crew data
      const validatedCrewData = insertCrewSchema.parse(crewData);
      
      // Create crew
      const crew = await storage.createCrew(validatedCrewData);
      
      // Create crew members if provided
      if (members && Array.isArray(members)) {
        for (const member of members) {
          const validatedMemberData = insertCrewMemberSchema.parse({
            ...member,
            crewId: crew.id,
          });
          await storage.createCrewMember(validatedMemberData);
        }
      }
      
      res.json(crew);
    } catch (error) {
      console.error("Error creating crew:", error);
      res.status(500).json({ message: "Failed to create crew" });
    }
  });

  app.put('/api/crews/:id', isAuthenticated, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const updateData = req.body;
      const crew = await storage.updateCrew(crewId, updateData);
      res.json(crew);
    } catch (error) {
      console.error("Error updating crew:", error);
      res.status(500).json({ message: "Failed to update crew" });
    }
  });

  app.patch('/api/crews/:id', isAuthenticated, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const updateData = req.body;
      const crew = await storage.updateCrew(crewId, updateData);
      res.json(crew);
    } catch (error) {
      console.error("Error updating crew:", error);
      res.status(500).json({ message: "Failed to update crew" });
    }
  });

  app.delete('/api/crews/:id', isAuthenticated, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      await storage.deleteCrew(crewId);
      res.json({ message: "Crew deleted successfully" });
    } catch (error) {
      console.error("Error deleting crew:", error);
      res.status(500).json({ message: "Failed to delete crew" });
    }
  });

  // Crew Members routes
  app.get('/api/crew-members', isAuthenticated, async (req: any, res) => {
    try {
      const crewId = parseInt(req.query.crewId as string);
      if (!crewId) {
        return res.status(400).json({ message: "Crew ID is required" });
      }
      
      const members = await storage.getCrewMembersByCrewId(crewId);
      res.json(members);
    } catch (error) {
      console.error("Error fetching crew members:", error);
      res.status(500).json({ message: "Failed to fetch crew members" });
    }
  });

  app.post('/api/crew-members', isAuthenticated, async (req: any, res) => {
    try {
      const memberData = insertCrewMemberSchema.parse(req.body);
      const member = await storage.createCrewMember(memberData);
      res.json(member);
    } catch (error) {
      console.error("Error creating crew member:", error);
      res.status(500).json({ message: "Failed to create crew member" });
    }
  });

  app.put('/api/crew-members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const updateData = req.body;
      const member = await storage.updateCrewMember(memberId, updateData);
      res.json(member);
    } catch (error) {
      console.error("Error updating crew member:", error);
      res.status(500).json({ message: "Failed to update crew member" });
    }
  });

  app.delete('/api/crew-members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);
      await storage.deleteCrewMember(memberId);
      res.json({ message: "Crew member deleted successfully" });
    } catch (error) {
      console.error("Error deleting crew member:", error);
      res.status(500).json({ message: "Failed to delete crew member" });
    }
  });

  // Project routes
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get all projects for the firm
      const allProjects = await storage.getProjectsByFirmId(firmId);
      
      // Filter projects based on user access rights
      let accessibleProjects: any[] = [];
      
      if (user.role === 'admin') {
        // Admins see all projects
        accessibleProjects = allProjects;
      } else {
        // Non-admin users see only their own projects and shared projects
        for (const project of allProjects) {
          // Check if user is the project leader
          if (project.leiterId === userId) {
            accessibleProjects.push(project);
            continue;
          }
          
          // Check if project is shared with the user
          const shares = await storage.getProjectShares(project.id);
          const hasAccess = shares.some(share => share.sharedWith === userId);
          
          if (hasAccess) {
            accessibleProjects.push(project);
          }
        }
      }
      
      res.json(accessibleProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      console.log('Fetching project with ID:', projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const project = await storage.getProjectById(projectId);
      console.log('Project from database:', project);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check access permissions
      let hasAccess = false;
      
      if (user.role === 'admin') {
        hasAccess = true;
      } else if (project.leiterId === userId) {
        hasAccess = true;
      } else {
        // Check if project is shared with the user
        const shares = await storage.getProjectShares(projectId);
        hasAccess = shares.some(share => share.sharedWith === userId);
      }
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this project" });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Get project history
  app.get('/api/projects/:id/history', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const history = await storage.getProjectHistory(projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching project history:", error);
      res.status(500).json({ message: "Failed to fetch project history" });
    }
  });

  app.get('/api/project/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const project = await storage.getProjectById(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('Creating project with data:', req.body);
      
      // Очищаем пустые даты перед парсингом
      const cleanedData = { ...req.body, leiterId: userId };
      if (cleanedData.workStartDate === '') {
        cleanedData.workStartDate = null;
      }
      if (cleanedData.workEndDate === '') {
        cleanedData.workEndDate = null;
      }
      if (cleanedData.equipmentExpectedDate === '') {
        cleanedData.equipmentExpectedDate = null;
      }
      if (cleanedData.equipmentArrivedDate === '') {
        cleanedData.equipmentArrivedDate = null;
      }
      
      const projectData = insertProjectSchema.parse(cleanedData);
      
      console.log('Parsed project data:', projectData);
      const project = await storage.createProject(projectData);
      
      // Логируем создание проекта в истории
      await storage.createProjectHistoryEntry({
        projectId: project.id,
        userId,
        changeType: 'created',
        fieldName: 'project',
        oldValue: null,
        newValue: 'created',
        description: `Проект создан пользователем`,
      });
      
      console.log('Project created successfully:', project);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updateData = req.body;
      const project = await storage.updateProject(projectId, updateData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.patch('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updateData = req.body;
      const userId = req.user.claims.sub;
      
      // Получаем данные проекта до изменения для истории
      const currentProject = await storage.getProjectById(projectId);
      
      // Обновляем проект
      const project = await storage.updateProject(projectId, updateData);
      
      // Логируем изменения в истории
      for (const [key, newValue] of Object.entries(updateData)) {
        const oldValue = currentProject ? currentProject[key as keyof typeof currentProject] : null;
        
        if (oldValue !== newValue) {
          let description = '';
          let changeType = 'info_update';
          
          if (key === 'status') {
            changeType = 'status_change';
            const statusLabels: any = {
              'planning': 'Планирование',
              'equipment_waiting': 'Ожидание оборудования',
              'equipment_arrived': 'Оборудование поступило',
              'work_scheduled': 'Работы запланированы',
              'work_in_progress': 'Работы в процессе',
              'work_completed': 'Работы завершены',
              'invoiced': 'Выставлен счет',
              'paid': 'Оплачено',
              'done': 'Завершено'
            };
            description = `Статус изменен с "${statusLabels[oldValue] || oldValue}" на "${statusLabels[newValue] || newValue}"`;
          } else if (key === 'equipmentExpectedDate' || key === 'equipmentArrivedDate') {
            changeType = 'equipment_update';
            description = key === 'equipmentExpectedDate' 
              ? `Дата ожидания оборудования изменена на ${new Date(newValue).toLocaleDateString('ru-RU')}`
              : `Дата поступления оборудования изменена на ${new Date(newValue).toLocaleDateString('ru-RU')}`;
            
            // Отправляем email уведомление о готовности оборудования
            if (key === 'equipmentArrivedDate' && newValue && currentProject?.crewId) {
              try {
                await emailNotificationService.sendEquipmentReadyNotification(projectId, currentProject.crewId);
                console.log(`Email notification sent for equipment ready: project ${projectId}`);
              } catch (emailError) {
                console.warn(`Failed to send email notification for equipment ready:`, emailError);
              }
            }
            
            // Отправляем email уведомление об изменении сроков оборудования
            if (key === 'equipmentExpectedDate' && currentProject?.crewId && newValue !== oldValue) {
              try {
                await emailNotificationService.sendProjectDateUpdateNotification(projectId, currentProject.crewId, 'equipment_date');
                console.log(`Email notification sent for equipment date update: project ${projectId}`);
              } catch (emailError) {
                console.warn(`Failed to send email notification for equipment date update:`, emailError);
              }
            }
          } else if (key === 'workStartDate' || key === 'workEndDate') {
            changeType = 'date_update';
            description = key === 'workStartDate'
              ? `Дата начала работ изменена на ${new Date(newValue).toLocaleDateString('ru-RU')}`
              : `Дата окончания работ изменена на ${new Date(newValue).toLocaleDateString('ru-RU')}`;
            
            // Отправляем email уведомление о изменении дат работ
            if (currentProject?.crewId && newValue !== oldValue) {
              try {
                await emailNotificationService.sendProjectDateUpdateNotification(projectId, currentProject.crewId, 'work_date');
                console.log(`Email notification sent for work date update: project ${projectId}`);
              } catch (emailError) {
                console.warn(`Failed to send email notification for work date update:`, emailError);
              }
              
              // Обновляем Google Calendar события при изменении дат работ
              try {
                await googleCalendarService.updateProjectDates(projectId, currentProject.crewId, {
                  workStartDate: key === 'workStartDate' ? newValue : currentProject.workStartDate,
                  workEndDate: key === 'workEndDate' ? newValue : currentProject.workEndDate
                });
                console.log(`Google Calendar events updated for project ${projectId}`);
              } catch (calendarError) {
                console.warn(`Failed to update Google Calendar events:`, calendarError);
              }
            }
          } else if (key === 'needsCallForEquipmentDelay' || key === 'needsCallForCrewDelay' || key === 'needsCallForDateChange') {
            changeType = 'call_update';
            description = newValue 
              ? `Требуется звонок клиенту`
              : `Звонок клиенту больше не требуется`;
          } else if (key === 'crewId') {
            changeType = 'assignment_change';
            description = `Команда изменена`;
            
            // Создаем события в Google Calendar для участников бригады
            if (newValue && newValue !== oldValue) {
              try {
                await googleCalendarService.createProjectEventForCrewMembers(projectId, newValue);
                console.log(`Google Calendar events created for project assignment: project ${projectId} to crew ${newValue}`);
              } catch (calendarError) {
                console.warn(`Failed to create Google Calendar events for project assignment:`, calendarError);
              }
            }
          } else {
            description = `Поле "${key}" изменено`;
          }
          
          await storage.createProjectHistoryEntry({
            projectId,
            userId,
            changeType: changeType as any,
            fieldName: key,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: newValue ? String(newValue) : null,
            description,
          });
        }
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Service routes
  app.get('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.query.projectId as string);
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }
      
      const services = await storage.getServicesByProjectId(projectId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      // Кастомная схема для API которая принимает строки для price и quantity
      const serviceApiSchema = insertServiceSchema.extend({
        price: z.union([z.string(), z.number()]).transform(val => val.toString()),
        quantity: z.union([z.string(), z.number()]).transform(val => val.toString()),
      });
      
      const serviceData = serviceApiSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Добавлена новая услуга: ${service.productName || service.productKey}`,
        });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      
      // Получаем данные услуги до изменения для истории
      const currentService = await storage.getServiceById(serviceId);
      
      // Кастомная схема для API которая принимает строки для price и quantity
      const serviceApiSchema = insertServiceSchema.extend({
        price: z.union([z.string(), z.number()]).transform(val => val.toString()),
        quantity: z.union([z.string(), z.number()]).transform(val => val.toString()),
      }).partial();
      
      const serviceData = serviceApiSchema.parse(req.body);
      const service = await storage.updateService(serviceId, serviceData);
      
      // Добавляем запись в историю проекта об изменении
      const userId = req.user.claims.sub;
      if (userId && service && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Изменена услуга: ${service.productName || service.productKey}`,
        });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      
      // Получаем данные услуги перед удалением для истории
      const service = await storage.getServiceById(serviceId);
      
      await storage.deleteService(serviceId);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId && service && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Удалена услуга: ${service.productName || service.productKey}`,
        });
      }
      
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Project status management routes
  app.patch('/api/projects/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const rawData = z.object({
        status: z.enum(['planning', 'equipment_waiting', 'equipment_arrived', 'work_scheduled', 'work_in_progress', 'work_completed', 'invoiced', 'paid']),
        equipmentExpectedDate: z.string().optional(),
        equipmentArrivedDate: z.string().optional(),
        workStartDate: z.string().optional(),
        workEndDate: z.string().optional(),
      }).parse(req.body);

      // Обрабатываем даты - пустые строки заменяем на null
      const validatedData = {
        status: rawData.status,
        equipmentExpectedDate: rawData.equipmentExpectedDate && rawData.equipmentExpectedDate.trim() !== '' ? rawData.equipmentExpectedDate : null,
        equipmentArrivedDate: rawData.equipmentArrivedDate && rawData.equipmentArrivedDate.trim() !== '' ? rawData.equipmentArrivedDate : null,
        workStartDate: rawData.workStartDate && rawData.workStartDate.trim() !== '' ? rawData.workStartDate : null,
        workEndDate: rawData.workEndDate && rawData.workEndDate.trim() !== '' ? rawData.workEndDate : null,
      };

      const project = await storage.updateProject(id, validatedData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId) {
        await storage.createProjectHistoryEntry({
          projectId: id,
          userId,
          changeType: 'status_change',
          description: `Статус изменен на: ${validatedData.status}`,
        });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(500).json({ message: "Failed to update project status" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Invoice routes
  app.get('/api/invoices/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admins can view invoices
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Only administrators can view invoices." });
      }
      
      const invoices = await storage.getInvoicesByFirmId(firmId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Statistics routes
  app.get('/api/stats/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admins can view full statistics
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Only administrators can view statistics." });
      }
      
      const stats = await storage.getProjectStats(firmId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Invoice routes
  app.post('/api/invoice/create', isAuthenticated, async (req: any, res) => {
    try {
      console.log('Invoice creation request:', req.body);
      const { projectId } = req.body;
      const userId = req.user.claims.sub;
      console.log('User ID:', userId, 'Project ID:', projectId);
      
      if (!projectId) {
        console.log('Error: Project ID is required');
        return res.status(400).json({ message: "Project ID is required" });
      }

      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const services = await storage.getServicesByProjectId(projectId);
      if (services.length === 0) {
        return res.status(400).json({ message: "No services found for this project" });
      }

      // Get firm details for Invoice Ninja integration
      const firms = await storage.getFirmsByUserId(req.user.claims.sub);
      const firm = firms.find(f => f.id === project.firmId);
      
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      const client = await storage.getClientsByFirmId(firm.id);
      const projectClient = client.find(c => c.id === project.clientId);
      
      if (!projectClient) {
        return res.status(404).json({ message: "Client not found" });
      }

      const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
      
      // Create invoice in Invoice Ninja with installation person details
      const installationPerson = {
        firstName: project.installationPersonFirstName || '',
        lastName: project.installationPersonLastName || '',
        address: project.installationPersonAddress || '',
        uniqueId: project.installationPersonUniqueId || '',
        phone: project.installationPersonPhone || ''
      };
      
      const invoiceData = {
        client_id: projectClient.ninjaClientId || '',
        line_items: services.map(service => ({
          quantity: parseFloat(service.quantity),
          cost: parseFloat(service.price),
          product_key: service.productKey || '',
          notes: service.description,
          custom_value1: service.isCustom ? 'custom' : 'catalog',
          custom_value2: '',
        })),
        // Project and installation details
        custom_value1: `PROJ-${projectId}`,
        custom_value2: project.crewId ? `CREW-${project.crewId}` : '',
        custom_value3: installationPerson.uniqueId ? `ID: ${installationPerson.uniqueId}` : '',
        custom_value4: installationPerson.phone ? `Tel: ${installationPerson.phone}` : '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        public_notes: buildInstallationNotesGerman(installationPerson, project),
        private_notes: `Generated from SCAC Project ${projectId}. Client: ${projectClient.name}`,
      };

      const ninjaInvoice = await invoiceNinja.createInvoice(invoiceData);
      
      // Save invoice to database
      const invoice = await storage.createInvoice({
        projectId: projectId,
        invoiceId: ninjaInvoice.id,
        invoiceNumber: ninjaInvoice.number,
        invoiceDate: ninjaInvoice.date,
        dueDate: ninjaInvoice.due_date,
        totalAmount: ninjaInvoice.amount.toString(),
        isPaid: false,
      });

      // Скачиваем PDF счета и сохраняем в файловое хранилище
      try {
        console.log(`Downloading PDF for invoice: ${ninjaInvoice.id}`);
        const pdfBuffer = await invoiceNinja.downloadInvoicePDF(ninjaInvoice.id);
        
        console.log(`Saving PDF to file storage for project ${projectId}`);
        const savedFile = await fileStorageService.saveInvoicePDF(
          pdfBuffer,
          ninjaInvoice.number,
          projectId,
          userId
        );
        
        console.log(`Successfully saved invoice PDF with file ID: ${savedFile.fileId}`);
      } catch (pdfError) {
        console.error(`Warning: Failed to download/save invoice PDF:`, pdfError);
        // Не прерываем процесс создания счета, если загрузка PDF не удалась
      }

      // Выполняем обновление проекта и запись в историю в одной транзакции
      console.log(`Adding history entry for project ${projectId}, userId: ${userId}, invoice: ${ninjaInvoice.number}`);
      await db.transaction(async (tx) => {
        // Добавляем запись в историю проекта о создании счета
        if (userId) {
          const historyEntry = {
            projectId,
            userId,
            changeType: 'info_update' as const,
            fieldName: 'invoice',
            oldValue: null,
            newValue: ninjaInvoice.number,
            description: `Создан счет №${ninjaInvoice.number} на сумму ${ninjaInvoice.amount}`,
          };
          console.log(`History entry data:`, historyEntry);
          const [result] = await tx
            .insert(projectHistory)
            .values(historyEntry)
            .returning();
          console.log(`Successfully added history entry with ID ${result.id} for invoice ${ninjaInvoice.number}`);
        }

        // Update project status and invoice info
        await tx.update(projects)
          .set({ 
            status: 'invoiced',
            invoiceNumber: ninjaInvoice.number,
            invoiceUrl: `${firm.invoiceNinjaUrl}/invoices/${ninjaInvoice.id}`,
            updatedAt: new Date()
          })
          .where(eq(projects.id, projectId));
      });

      res.json({
        invoice,
        invoiceNumber: ninjaInvoice.number,
        invoiceUrl: `${firm.invoiceNinjaUrl}/invoices/${ninjaInvoice.id}`,
      });
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      console.error("Error details:", error.message, error.stack);
      res.status(500).json({ 
        message: "Failed to create invoice", 
        error: error.message 
      });
    }
  });



  // Invoice Ninja catalog routes
  app.get('/api/catalog/products', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }

      const userId = req.user.claims.sub;
      const firms = await storage.getFirmsByUserId(userId);
      const firm = firms.find(f => f.id === firmId);
      
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
      const products = await invoiceNinja.getProducts();
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching catalog products:", error);
      res.status(500).json({ message: "Failed to fetch catalog products" });
    }
  });

  // Project Files routes
  app.get('/api/projects/:id/files', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = await storage.getFilesByProjectId(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching project files:", error);
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post('/api/projects/:id/files', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const fileData = insertProjectFileSchema.parse({
        ...req.body,
        projectId,
      });
      
      const file = await storage.createFile(fileData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId) {
        const fileTypeLabels = {
          'report_photo': 'фото отчет',
          'review_document': 'документ отзыва',
          'acceptance': 'документ приемки'
        };
        const fileTypeLabel = fileTypeLabels[file.fileType as keyof typeof fileTypeLabels] || file.fileType;
        
        await storage.createProjectHistoryEntry({
          projectId,
          userId,
          changeType: 'file_added',
          description: `Добавлен файл: ${file.fileName || fileTypeLabel}`,
        });
      }
      
      res.json(file);
    } catch (error) {
      console.error("Error creating project file:", error);
      res.status(500).json({ message: "Failed to create project file" });
    }
  });

  app.delete('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fileId = parseInt(req.params.id);
      
      // Получаем данные файла перед удалением для истории
      const file = await storage.getFileById(fileId);
      
      await storage.deleteFile(fileId);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId && file) {
        const fileTypeLabels = {
          'report_photo': 'фото отчет',
          'review_document': 'документ отзыва',
          'acceptance': 'документ приемки'
        };
        const fileTypeLabel = fileTypeLabels[file.fileType as keyof typeof fileTypeLabels] || file.fileType;
        
        await storage.createProjectHistoryEntry({
          projectId: file.projectId,
          userId,
          changeType: 'file_deleted',
          description: `Удален файл: ${file.fileName || fileTypeLabel}`,
        });
      }
      
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: "Failed to delete file" });
    }
  });

  // Project Reports routes
  app.get('/api/projects/:id/reports', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const reports = await storage.getReportsByProjectId(projectId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching project reports:", error);
      res.status(500).json({ message: "Failed to fetch project reports" });
    }
  });

  app.post('/api/projects/:id/reports', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const reportData = insertProjectReportSchema.parse({
        ...req.body,
        projectId,
      });
      
      const report = await storage.createReport(reportData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId) {
        const stars = '★'.repeat(report.rating);
        await storage.createProjectHistoryEntry({
          projectId,
          userId,
          changeType: 'report_added',
          description: `Создан отчет с оценкой ${report.rating}/5 ${stars}`,
        });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error creating project report:", error);
      res.status(500).json({ message: "Failed to create project report" });
    }
  });

  app.patch('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const updateData = req.body;
      const report = await storage.updateReport(reportId, updateData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId && report) {
        const stars = '★'.repeat(report.rating);
        await storage.createProjectHistoryEntry({
          projectId: report.projectId,
          userId,
          changeType: 'report_updated',
          description: `Обновлен отчет с оценкой ${report.rating}/5 ${stars}`,
        });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error updating report:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  app.delete('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      
      // Получаем данные отчета перед удалением для истории
      const report = await storage.getReportById(reportId);
      
      await storage.deleteReport(reportId);
      
      // Добавляем запись в историю проекта
      const userId = req.user.claims.sub;
      if (userId && report) {
        const stars = '★'.repeat(report.rating);
        await storage.createProjectHistoryEntry({
          projectId: report.projectId,
          userId,
          changeType: 'report_deleted',
          description: `Удален отчет с оценкой ${report.rating}/5 ${stars}`,
        });
      }
      
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Statistics routes
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      const stats = await storage.getProjectStats(firmId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Project History routes  
  app.get('/api/project-history/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }
      
      const history = await storage.getProjectHistory(projectId);
      res.json(history);
    } catch (error) {
      console.error("Ошибка получения истории проекта:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  // Project Notes routes
  app.get('/api/projects/:projectId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      console.log('GET /api/projects/:projectId/notes - получение примечаний для проекта:', projectId);
      
      if (isNaN(projectId)) {
        console.log('Неверный ID проекта:', req.params.projectId);
        return res.status(400).json({ error: "Неверный ID проекта" });
      }
      
      const notes = await db.select().from(projectNotes).where(eq(projectNotes.projectId, projectId));
      console.log('Найдено примечаний:', notes.length);
      console.log('Примечания:', notes);
      
      res.json(notes);
    } catch (error) {
      console.error("Ошибка получения примечаний проекта:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post('/api/projects/:projectId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const userId = req.user?.claims?.sub || req.user?.id;
      
      console.log('POST /api/projects/:projectId/notes - создание примечания');
      console.log('ProjectID:', projectId);
      console.log('UserID:', userId);
      console.log('Request body:', req.body);
      
      if (isNaN(projectId)) {
        console.log('Неверный ID проекта:', req.params.projectId);
        return res.status(400).json({ error: "Неверный ID проекта" });
      }
      
      if (!userId) {
        console.log('Пользователь не найден в запросе');
        return res.status(401).json({ error: "Пользователь не авторизован" });
      }
      
      const validatedData = insertProjectNoteSchema.parse({
        ...req.body,
        projectId,
        userId
      });
      
      console.log('Валидированные данные:', validatedData);

      const [note] = await db.insert(projectNotes).values(validatedData).returning();
      console.log('Создано примечание:', note);
      
      // Добавляем запись в историю (без приоритета в описании, он будет показан в бейдже)
      const historyEntry = {
        projectId,
        userId,
        changeType: 'note_added' as const,
        description: `Добавлено примечание: ${note.content.substring(0, 50)}${note.content.length > 50 ? '...' : ''}`
      };
      console.log('Добавляем в историю:', historyEntry);
      
      await db.insert(projectHistory).values(historyEntry);
      console.log('История обновлена');

      res.json(note);
    } catch (error) {
      console.error("Ошибка создания примечания:", error);
      console.error("Стек ошибки:", error.stack);
      res.status(500).json({ error: "Ошибка сервера", details: error.message });
    }
  });

  // Project Sharing routes
  app.post('/api/projects/:projectId/share', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      const userId = req.user.claims.sub;
      if (!userId) {
        return res.status(401).json({ error: "Пользователь не авторизован" });
      }

      const { sharedWith, permission = 'view' } = req.body;
      if (!sharedWith) {
        return res.status(400).json({ error: "Необходимо указать пользователя для предоставления доступа" });
      }

      const share = await storage.shareProject(projectId, userId, sharedWith, permission);
      
      // Добавить запись в историю проекта
      await storage.createProjectHistoryEntry({
        projectId,
        userId,
        changeType: 'info_update',
        description: `Проект предоставлен в совместный доступ пользователю с правами ${permission === 'edit' ? 'редактирования' : 'просмотра'}`,
      });

      res.json(share);
    } catch (error) {
      console.error("Ошибка предоставления доступа к проекту:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.get('/api/projects/:projectId/shares', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      const shares = await storage.getProjectShares(projectId);
      res.json(shares);
    } catch (error) {
      console.error("Ошибка получения списка предоставленного доступа:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.delete('/api/projects/:projectId/shares/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const { userId } = req.params;
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      const currentUserId = req.user.claims.sub;
      if (!currentUserId) {
        return res.status(401).json({ error: "Пользователь не авторизован" });
      }

      await storage.removeProjectShare(projectId, userId);
      
      // Добавить запись в историю проекта
      await storage.createProjectHistoryEntry({
        projectId,
        userId: currentUserId,
        changeType: 'info_update',
        description: `Удален совместный доступ к проекту`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Ошибка удаления доступа к проекту:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  // Firm-User management endpoints
  app.get('/api/firms/:firmId/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      
      const users = await storage.getUsersByFirmId(firmId);
      res.json(users);
    } catch (error) {
      console.error("Ошибка получения пользователей фирмы:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post('/api/firms/:firmId/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { firmId, userId } = req.params;
      
      await storage.assignUserToFirm(userId, firmId);
      res.json({ success: true, message: "Пользователь добавлен в фирму" });
    } catch (error) {
      console.error("Ошибка добавления пользователя в фирму:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.delete('/api/firms/:firmId/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { firmId, userId } = req.params;
      
      await storage.removeUserFromFirm(userId, firmId);
      res.json({ success: true, message: "Пользователь удален из фирмы" });
    } catch (error) {
      console.error("Ошибка удаления пользователя из фирмы:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  // Get users with their firm assignments
  app.get('/api/users-with-firms', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getUsers();
      const usersWithFirms = await Promise.all(
        allUsers.map(async (user) => {
          const userFirms = await storage.getFirmsByUserId(user.id);
          return {
            ...user,
            firms: userFirms,
          };
        })
      );
      res.json(usersWithFirms);
    } catch (error) {
      console.error("Ошибка получения пользователей с фирмами:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  // Синхронизация статуса платежа из Invoice Ninja
  app.post('/api/invoices/sync-payment-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { invoiceNumber } = z.object({
        invoiceNumber: z.string(),
      }).parse(req.body);

      // Find invoice in our database across all accessible firms
      let invoice;
      let firm;
      const userFirms = await storage.getFirmsByUserId(userId);
      
      for (const userFirm of userFirms) {
        const firmInvoices = await storage.getInvoicesByFirmId(userFirm.id);
        const foundInvoice = firmInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
        if (foundInvoice) {
          invoice = foundInvoice;
          firm = userFirm;
          break;
        }
      }
      
      if (!invoice || !firm || !invoice.invoiceId) {
        return res.status(404).json({ message: "Invoice not found or no Invoice Ninja ID" });
      }

      // Check payment status in Invoice Ninja
      const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
      const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(invoice.invoiceId);

      console.log(`Invoice ${invoiceNumber} payment status in Invoice Ninja:`, paymentStatus);

      // Update our database if status has changed
      if (paymentStatus.isPaid !== invoice.isPaid) {
        await storage.updateInvoice(invoice.id, { isPaid: paymentStatus.isPaid });

        if (paymentStatus.isPaid) {
          // Update project status to paid
          await storage.updateProject(invoice.projectId, { status: 'paid' });

          // Add history entry
          await storage.createProjectHistoryEntry({
            projectId: invoice.projectId,
            userId,
            changeType: 'status_change',
            fieldName: 'status',
            oldValue: 'invoiced',
            newValue: 'paid',
            description: `Счет №${invoiceNumber} помечен как оплаченный (синхронизация из Invoice Ninja)`,
          });
        }

        console.log(`Updated invoice ${invoiceNumber} payment status: ${paymentStatus.isPaid ? 'paid' : 'unpaid'}`);
      }

      res.json({ 
        success: true, 
        updated: paymentStatus.isPaid !== invoice.isPaid,
        isPaid: paymentStatus.isPaid,
        statusId: paymentStatus.statusId
      });

    } catch (error) {
      console.error("Error syncing invoice payment status:", error);
      res.status(500).json({ message: "Failed to sync payment status", error: error.message });
    }
  });

  // Синхронизация всех счетов фирмы с Invoice Ninja
  app.post('/api/invoices/sync-all-payment-status/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firmId } = req.params;
      
      // Verify user has access to this firm
      const userFirms = await storage.getFirmsByUserId(userId);
      const firm = userFirms.find(f => f.id === firmId);
      
      if (!firm) {
        return res.status(403).json({ message: "Access denied to this firm" });
      }

      const invoices = await storage.getInvoicesByFirmId(firmId);
      const invoiceNinja = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);
      
      let updatedCount = 0;
      const results = [];

      for (const invoice of invoices) {
        if (!invoice.invoiceId) {
          results.push({ invoiceNumber: invoice.invoiceNumber, status: 'no_ninja_id' });
          continue;
        }

        try {
          const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(invoice.invoiceId);
          
          if (paymentStatus.isPaid !== invoice.isPaid) {
            await storage.updateInvoice(invoice.id, { isPaid: paymentStatus.isPaid });
            
            if (paymentStatus.isPaid) {
              await storage.updateProject(invoice.projectId, { status: 'paid' });
              await storage.createProjectHistoryEntry({
                projectId: invoice.projectId,
                userId,
                changeType: 'status_change',
                fieldName: 'status',
                oldValue: 'invoiced',
                newValue: 'paid',
                description: `Счет №${invoice.invoiceNumber} помечен как оплаченный (автосинхронизация)`,
              });
            }
            
            updatedCount++;
            results.push({ 
              invoiceNumber: invoice.invoiceNumber, 
              status: 'updated', 
              isPaid: paymentStatus.isPaid 
            });
          } else {
            results.push({ 
              invoiceNumber: invoice.invoiceNumber, 
              status: 'no_change', 
              isPaid: invoice.isPaid 
            });
          }
        } catch (error) {
          console.error(`Error checking invoice ${invoice.invoiceNumber}:`, error);
          results.push({ 
            invoiceNumber: invoice.invoiceNumber, 
            status: 'error', 
            error: error.message 
          });
        }
      }

      res.json({
        success: true,
        totalInvoices: invoices.length,
        updatedCount,
        results
      });

    } catch (error) {
      console.error("Error syncing all invoices:", error);
      res.status(500).json({ message: "Failed to sync invoices", error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
