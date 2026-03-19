import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { supabase } from "./supabaseClient";
import { authenticateSupabase, requireAdmin as requireAdminMiddleware } from "./middleware/supabaseAuth.js";
import authRouter from "./routes/auth.js";
import { InvoiceNinjaService } from "./services/invoiceNinja";
import { SmtpService } from "./services/smtp";
import { db } from "./db";
import { firms, projects, projectHistory, projectNotes, fileStorage, projectFiles, projectReports, projectCrewSnapshots, projectShares, reclamations, reclamationHistory, craftosAppointments } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
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
import workerAuthRoutes from "./routes/workerAuth";
import workerPortalRoutes from "./routes/workerPortal";
import reclamationRoutes from "./routes/reclamations";
import notificationRoutes from "./routes/notifications";
import craftosRoutes from "./routes/craftos";
import { fileStorageService } from "./storage/fileStorage";
import { craftosSyncService } from "./services/craftosSync";

// Admin role check middleware (legacy - use requireAdminMiddleware from supabaseAuth instead)
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    // New structure: req.user.id and req.user.role
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role !== 'admin') {
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

// Authorization helpers
async function requireProjectAccess(req: any, projectId: number): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) return false;
  if (req.user.role === 'admin') return true;
  return await storage.hasProjectAccess(userId, projectId);
}

async function requireCrewAccess(req: any, crewId: number): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) return false;
  if (req.user.role === 'admin') return true;
  const crew = await storage.getCrewById(crewId);
  if (!crew) return false;
  return await storage.hasUserFirmAccess(userId, crew.firmId.toString());
}

async function requireFirmAccessCheck(req: any, firmId: string): Promise<boolean> {
  const userId = req.user?.id;
  if (!userId) return false;
  if (req.user.role === 'admin') return true;
  return await storage.hasUserFirmAccess(userId, firmId);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Supabase Auth routes (replaces Replit Auth)
  app.use('/api/auth', authRouter);

  // File storage routes
  app.use('/api/files', fileRoutes);

  // Worker portal routes
  app.use('/api/worker-auth', workerAuthRoutes);
  app.use('/api/worker', workerPortalRoutes);

  // Reclamation routes - only mount on /api/reclamations
  // The /api/projects/:id/reclamation routes are handled separately below
  app.use('/api/reclamations', authenticateSupabase, reclamationRoutes);

  // Notification routes
  app.use('/api/notifications', authenticateSupabase, notificationRoutes);

  // CraftOS sync routes
  app.use('/api/craftos', authenticateSupabase, craftosRoutes);

  // Start CraftOS periodic sync
  craftosSyncService.startPeriodicSync().catch((err) => {
    console.error("[CraftOS] Failed to start periodic sync:", err.message);
  });

  // Test endpoint for history entries
  app.get('/api/test-history', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  // Auth routes moved to /api/auth router (see server/routes/auth.ts)


  app.patch('/api/invoice/mark-paid', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
        const firmInvoices = await storage.getInvoicesByFirmId(String(userFirm.id));
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
        const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
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

  app.get('/api/catalog/products/:firmId', authenticateSupabase, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      
      const firms = await storage.getFirms();
      const firm = firms.find(f => f.id === Number(firmId));
      
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      const ninjaService = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const products = await ninjaService.getProducts();
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Global products endpoint - uses first firm's Invoice Ninja credentials
  app.get('/api/catalog/products', authenticateSupabase, async (req: any, res) => {
    try {
      // Get credentials from first firm in database
      const firms = await storage.getFirms();
      const firm = firms[0];

      if (!firm || !firm.token || !firm.invoiceNinjaUrl) {
        console.log('No firm with Invoice Ninja credentials found');
        return res.status(500).json({ message: "Invoice Ninja API credentials not configured in firm settings" });
      }

      console.log('Using firm credentials:', { firmId: firm.id, firmName: firm.name, baseUrl: firm.invoiceNinjaUrl });

      const ninjaService = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
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
  app.get('/api/firms', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.put('/api/firms/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const { id } = req.params;
      // Only admins or users with firm access can update
      if (!(await requireFirmAccessCheck(req, id))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const firmData = req.body;

      const updated = await storage.updateFirm(id, firmData);

      res.json(updated);
    } catch (error) {
      console.error("Error updating firm:", error);
      res.status(500).json({ message: "Failed to update firm" });
    }
  });

  app.post('/api/firms/test-connection', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { invoiceNinjaUrl, token } = req.body;
      
      if (!invoiceNinjaUrl || !token) {
        return res.status(400).json({ message: "URL and API token are required" });
      }

      const ninjaService = new InvoiceNinjaService(token, invoiceNinjaUrl);
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

  app.post('/api/firms', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.get('/api/firms/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const firmId = req.params.id;
      
      const firm = await storage.getFirmById(firmId);
      
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }
      
      // Check if user has access to this firm
      if (user && user.role !== 'admin') {
        const hasAccess = await storage.hasUserFirmAccess(userId, firmId);
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }
      }
      
      res.json(firm);
    } catch (error) {
      console.error('Error fetching firm:', error);
      res.status(500).json({ message: 'Failed to fetch firm' });
    }
  });

  app.patch('/api/firms/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: 'Only admins can update firms' });
      }
      
      const firmId = req.params.id;
      const updateData = {
        name: req.body.name,
        invoiceNinjaUrl: req.body.invoiceNinjaUrl,
        token: req.body.token,
        address: req.body.address,
        taxId: req.body.taxId,
        smtpHost: req.body.smtpHost,
        smtpPort: req.body.smtpPort,
        smtpUser: req.body.smtpUser,
        smtpPassword: req.body.smtpPassword,
        smtpSecure: req.body.smtpSecure,
        smtpFrom: req.body.smtpFrom,
        emailSubjectTemplate: req.body.emailSubjectTemplate,
        emailBodyTemplate: req.body.emailBodyTemplate,
      };
      
      const updatedFirm = await storage.updateFirm(firmId, updateData);
      res.json(updatedFirm);
    } catch (error) {
      console.error('Error updating firm:', error);
      res.status(500).json({ message: 'Failed to update firm' });
    }
  });

  // Client routes - sync with Invoice Ninja
  app.get('/api/clients', authenticateSupabase, async (req: any, res) => {
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
        const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
        const ninjaClients = await invoiceNinja.getClients();
        
        // Sync with local database
        for (const ninjaClient of ninjaClients) {
          const existingClient = await storage.getClientByNinjaId(firmId, ninjaClient.id);
          if (!existingClient) {
            // Create new client in local database
            await storage.createClient({
              firmId: Number(firmId),
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

  app.get('/api/clients/single/:id', authenticateSupabase, async (req: any, res) => {
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

  app.patch('/api/clients/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Обновляем клиента в локальной базе
      const updatedClient = await storage.updateClient(Number(id), updateData);
      
      // Если есть Invoice Ninja ID, обновляем и там
      if (updatedClient.ninjaClientId && updateData.firmId) {
        const firm = await storage.getFirmById(updateData.firmId);
        if (firm?.token && firm?.invoiceNinjaUrl) {
          try {
            const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
            // Обновляем клиента в Invoice Ninja (если API поддерживает)
            console.log('Updating client in Invoice Ninja:', updatedClient.ninjaClientId);
          } catch (ninjaError) {
            console.warn('Could not update client in Invoice Ninja:', ninjaError);
          }
        }
      }
      
      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.post('/api/clients', authenticateSupabase, async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      
      // Get firm info to access Invoice Ninja
      const firm = await storage.getFirmById(clientData.firmId);
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      try {
        // Create client in Invoice Ninja first
        const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
        
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
      } catch (ninjaError: any) {
        console.warn("Warning: Could not create client in Invoice Ninja, creating locally only:", ninjaError?.message || String(ninjaError));
        // Fallback: create only in local database
        const client = await storage.createClient(clientData);
        res.json(client);
      }
    } catch (error: any) {
      console.error("Error creating client:", error?.message || String(error));
      res.status(500).json({ message: "Failed to create client" });
    }
  });

  // Delete client
  app.delete('/api/clients/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const clientId = parseInt(req.params.id);

      // Get the client to check it exists and get firmId
      const client = await storage.getClientById(clientId);
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      // Get firm info to access Invoice Ninja
      const firm = await storage.getFirmById(String(client.firmId));
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      // Try to delete from Invoice Ninja if client has ninjaClientId
      if (client.ninjaClientId) {
        try {
          const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
          await invoiceNinja.deleteClient(client.ninjaClientId);
        } catch (ninjaError: any) {
          console.warn("Warning: Could not delete client from Invoice Ninja:", ninjaError?.message || String(ninjaError));
          // Continue with local deletion even if Invoice Ninja fails
        }
      }

      // Delete from local database
      await storage.deleteClient(clientId);

      res.json({ message: 'Client deleted successfully' });
    } catch (error: any) {
      console.error("Error deleting client:", error?.message || String(error));
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Crew routes
  app.get('/api/crews', authenticateSupabase, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Admins see crews from all their firms, others see only selected firm
      let accessibleCrews: any[] = [];

      if (user.role === 'admin') {
        const userFirmsList = await storage.getFirmsByUserId(userId);
        const allCrewsArrays = await Promise.all(
          userFirmsList.map(f => storage.getCrewsByFirmId(String(f.id)))
        );
        accessibleCrews = allCrewsArrays.flat();
      } else {
        const hasAccess = await storage.hasUserFirmAccess(userId, firmId);
        if (hasAccess) {
          accessibleCrews = await storage.getCrewsByFirmId(firmId);
        }
      }
      
      // Отключаем кэширование для свежих данных
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.json(accessibleCrews);
    } catch (error) {
      console.error("Error fetching crews:", error);
      res.status(500).json({ message: "Failed to fetch crews" });
    }
  });

  app.get('/api/crews/single/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log('Fetching crew with ID:', id);
      
      const userId = req.user.id;
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
        const firmProjects = await storage.getProjectsByFirmId(String(crew.firmId));
        
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

  app.post('/api/crews', authenticateSupabase, async (req: any, res) => {
    try {
      console.log('🚀 POST /api/crews - Request received');
      console.log('📋 Request body:', JSON.stringify(req.body, null, 2));
      console.log('👤 User:', req.user?.claims?.sub);
      
      const { members, ...crewData } = req.body;

      // Convert firmId to number if it's a string
      if (crewData.firmId && typeof crewData.firmId === 'string') {
        crewData.firmId = parseInt(crewData.firmId, 10);
      }

      console.log('🔧 Separated crew data:', JSON.stringify(crewData, null, 2));
      console.log('👥 Members:', JSON.stringify(members, null, 2));

      // Validate crew data
      const validatedCrewData = insertCrewSchema.parse(crewData);
      console.log('✅ Crew data validated:', JSON.stringify(validatedCrewData, null, 2));
      
      // Create crew
      const crew = await storage.createCrew(validatedCrewData);
      console.log('🎯 Crew created:', JSON.stringify(crew, null, 2));
      
      // Create crew members if provided
      if (members && Array.isArray(members)) {
        console.log(`👥 Creating ${members.length} crew members...`);
        for (const member of members) {
          const validatedMemberData = insertCrewMemberSchema.parse({
            ...member,
            crewId: crew.id,
          });
          const createdMember = await storage.createCrewMember(validatedMemberData);
          console.log('✅ Member created:', JSON.stringify(createdMember, null, 2));
        }
      }
      
      console.log('🎉 Crew creation successful, sending response');
      res.json(crew);
    } catch (error) {
      console.error("❌ Error creating crew:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      res.status(500).json({ message: "Failed to create crew", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/crews/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      if (!(await requireCrewAccess(req, crewId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData = req.body;
      const crew = await storage.updateCrew(crewId, updateData);
      res.json(crew);
    } catch (error) {
      console.error("Error updating crew:", error);
      res.status(500).json({ message: "Failed to update crew" });
    }
  });

  app.patch('/api/crews/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      if (!(await requireCrewAccess(req, crewId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData = req.body;
      const crew = await storage.updateCrew(crewId, updateData);
      res.json(crew);
    } catch (error) {
      console.error("Error updating crew:", error);
      res.status(500).json({ message: "Failed to update crew" });
    }
  });

  app.delete('/api/crews/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      if (!(await requireCrewAccess(req, crewId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteCrew(crewId);
      res.json({ message: "Crew deleted successfully" });
    } catch (error) {
      console.error("Error deleting crew:", error);
      res.status(500).json({ message: "Failed to delete crew" });
    }
  });

  // Crew Members routes
  app.get('/api/crew-members', authenticateSupabase, async (req: any, res) => {
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



  app.post('/api/crew-members', authenticateSupabase, async (req: any, res) => {
    try {
      const memberData = insertCrewMemberSchema.parse(req.body);
      const member = await storage.createCrewMember(memberData);
      
      // Записываем в историю бригады добавление участника
      const today = new Date().toISOString().split('T')[0];
      const userId = req.user?.id;
      if (userId) {
        await storage.logCrewMemberAdded(memberData.crewId, member, today, userId);
      }
      
      res.json(member);
    } catch (error) {
      console.error("Error creating crew member:", error);
      res.status(500).json({ message: "Failed to create crew member" });
    }
  });

  app.put('/api/crew-members/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);
      // Check access via crew
      const member = await storage.getCrewMemberById(memberId);
      if (!member) {
        return res.status(404).json({ message: "Crew member not found" });
      }
      if (!(await requireCrewAccess(req, member.crewId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData = req.body;
      const updated = await storage.updateCrewMember(memberId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating crew member:", error);
      res.status(500).json({ message: "Failed to update crew member" });
    }
  });

  app.delete('/api/crew-members/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const memberId = parseInt(req.params.id);

      // Получаем данные участника перед удалением для истории
      const member = await storage.getCrewMemberById(memberId);
      if (member && !(await requireCrewAccess(req, member.crewId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (member) {
        const today = new Date().toISOString().split('T')[0];
        const userId = req.user?.id;

        // Определяем дату начала работы (можно использовать дату создания или задать)
        const startDate = '2025-01-01'; // Упрощено для демонстрации

        if (userId) {
          await storage.logCrewMemberRemoved(
            member.crewId,
            `${member.firstName} ${member.lastName}`,
            member.role || 'Не указана',
            startDate,
            today,
            userId
          );
        }
      }
      
      await storage.deleteCrewMember(memberId);
      res.json({ message: "Crew member deleted successfully" });
    } catch (error) {
      console.error("Error deleting crew member:", error);
      res.status(500).json({ message: "Failed to delete crew member" });
    }
  });

  // Crew History Endpoints
  app.get('/api/crews/:crewId/history', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const history = await storage.getCrewHistory(crewId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching crew history:', error);
      res.status(500).json({ message: 'Failed to fetch crew history' });
    }
  });

  app.post('/api/crews/:crewId/history', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.crewId);
      const entry = {
        ...req.body,
        crewId,
        createdBy: req.user?.claims?.sub || req.session?.userId
      };
      
      const historyEntry = await storage.createCrewHistoryEntry(entry);
      res.json(historyEntry);
    } catch (error) {
      console.error('Error creating crew history entry:', error);
      res.status(500).json({ message: 'Failed to create crew history entry' });
    }
  });

  // Crew Statistics routes
  app.get('/api/crews/stats/summary', authenticateSupabase, async (req: any, res) => {
    try {
      const from = req.query.from as string;
      const to = req.query.to as string;
      const firmId = req.query.firmId as string;
      
      if (!from || !to || !firmId) {
        return res.status(400).json({ message: "Date range (from/to) and firmId are required" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Get all crews for the firm
      const allCrews = await storage.getCrewsByFirmId(firmId);
      const crewsSummary = [];
      
      if (user.role === 'admin') {
        // Администратор видит все бригады компании без ограничений
        for (const crew of allCrews) {
          const projectsData = await storage.getCrewProjects(crew.id, { from, to, status: 'all', page: 1, size: 1000 });
          const stats = await storage.getCrewStatistics(crew.id, from, to);
          
          crewsSummary.push({
            id: crew.id,
            name: crew.name,
            uniqueNumber: crew.uniqueNumber,
            projectsCount: parseInt(projectsData.total.toString()),
            completedProjects: stats.metrics.completedObjects,
            overduePercentage: stats.metrics.overdueShare,
            avgCompletionTime: stats.metrics.avgDurationDays,
            reclamationsCount: stats.metrics.reclamations?.total || 0
          });
        }
      } else {
        // Для неадминов проверяем доступ к каждой бригаде через проекты
        for (const crew of allCrews) {
          let hasAccess = false;
          
          const crewProjects = await storage.getProjectsByCrewId(crew.id);
          for (const project of crewProjects) {
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
          
          if (hasAccess) {
            const projectsData = await storage.getCrewProjects(crew.id, { from, to, status: 'all', page: 1, size: 1000 });
            const stats = await storage.getCrewStatistics(crew.id, from, to);

            crewsSummary.push({
              id: crew.id,
              name: crew.name,
              uniqueNumber: crew.uniqueNumber,
              projectsCount: parseInt(projectsData.total.toString()),
              completedProjects: stats.metrics.completedObjects,
              overduePercentage: stats.metrics.overdueShare,
              avgCompletionTime: stats.metrics.avgDurationDays,
              reclamationsCount: stats.metrics.reclamations?.total || 0
            });
          }
        }
      }
      
      res.json({
        period: { from, to },
        crews: crewsSummary
      });
    } catch (error) {
      console.error("Error fetching crews statistics summary:", error);
      res.status(500).json({ message: "Failed to fetch crews statistics summary" });
    }
  });

  app.get('/api/crews/:id/stats', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const from = req.query.from as string;
      const to = req.query.to as string;
      
      if (isNaN(crewId)) {
        return res.status(400).json({ message: "Invalid crew ID" });
      }
      
      if (!from || !to) {
        return res.status(400).json({ message: "Date range (from/to) is required" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const crew = await storage.getCrewById(crewId);
      if (!crew) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      // Check access permissions
      if (user.role !== 'admin') {
        // Для неадминов проверяем доступ через проекты бригады
        let hasAccess = false;
        const crewProjects = await storage.getProjectsByCrewId(crewId);
        
        for (const project of crewProjects) {
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
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied to this crew" });
        }
      }
      // Администраторы имеют полный доступ без дополнительных проверок
      
      // Get crew statistics
      const stats = await storage.getCrewStatistics(crewId, from, to);
      
      res.json({
        crewId: crewId,
        crewName: crew.name,
        period: { from, to },
        metrics: stats.metrics,
        charts: stats.charts
      });
    } catch (error) {
      console.error("Error fetching crew statistics:", error);
      res.status(500).json({ message: "Failed to fetch crew statistics" });
    }
  });

  app.get('/api/crews/:id/projects', authenticateSupabase, async (req: any, res) => {
    try {
      const crewId = parseInt(req.params.id);
      const from = req.query.from as string;
      const to = req.query.to as string;
      const status = req.query.status as string || 'all';
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 50;
      
      if (isNaN(crewId)) {
        return res.status(400).json({ message: "Invalid crew ID" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const crew = await storage.getCrewById(crewId);
      if (!crew) {
        return res.status(404).json({ message: "Crew not found" });
      }
      
      // Check access permissions
      if (user.role !== 'admin') {
        // Для неадминов проверяем доступ через проекты бригады
        let hasAccess = false;
        const crewProjects = await storage.getProjectsByCrewId(crewId);
        
        for (const project of crewProjects) {
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
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied to this crew" });
        }
      }
      // Администраторы имеют полный доступ без дополнительных проверок
      
      // Get crew projects with filtering
      const projects = await storage.getCrewProjects(crewId, { from, to, status, page, size });
      
      res.json(projects);
    } catch (error) {
      console.error("Error fetching crew projects:", error);
      res.status(500).json({ message: "Failed to fetch crew projects" });
    }
  });

  // Project routes
  app.get('/api/projects', authenticateSupabase, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
      const userId = req.user.id;
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

  app.get('/api/projects/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      console.log('Fetching project with ID:', projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }
      
      const userId = req.user.id;
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
  app.get('/api/projects/:id/history', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);

      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const history = await storage.getProjectHistory(projectId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching project history:", error);
      res.status(500).json({ message: "Failed to fetch project history" });
    }
  });
  
  // Get crew snapshot by ID
  app.get('/api/crew-snapshots/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const snapshotId = parseInt(req.params.id);
      
      if (isNaN(snapshotId)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }
      
      const snapshot = await storage.getCrewSnapshotById(snapshotId);
      
      if (!snapshot) {
        return res.status(404).json({ message: "Snapshot not found" });
      }
      
      res.json(snapshot);
    } catch (error) {
      console.error("Error fetching crew snapshot:", error);
      res.status(500).json({ message: "Failed to fetch crew snapshot" });
    }
  });

  app.get('/api/project/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
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

  app.post('/api/projects', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log('Creating project with data:', req.body);
      
      // Очищаем пустые даты перед парсингом
      const cleanedData = { ...req.body, leiterId: userId };

      // Преобразуем firmId в число если это строка
      if (typeof cleanedData.firmId === 'string') {
        cleanedData.firmId = parseInt(cleanedData.firmId, 10);
      }

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

      // Создаем снепшот бригады, если бригада была назначена
      if (project.crewId) {
        try {
          console.log(`Creating crew snapshot for project ${project.id}, crew ${project.crewId}`);
          const snapshot = await storage.createProjectCrewSnapshot(project.id, project.crewId, userId);
          
          // Получаем информацию о бригаде и участниках из снепшота
          const crewData = snapshot.crewData as any;
          const membersData = snapshot.membersData as any[];
          
          // Формируем список участников для отображения
          let membersList = '';
          if (membersData && membersData.length > 0) {
            const memberNames = membersData.map(member => 
              `${member.firstName || ''} ${member.lastName || ''}`.trim()
            ).filter(name => name.length > 0);
            
            if (memberNames.length > 0) {
              membersList = memberNames.join(', ');
            }
          }
          
          // Формируем описание с именами участников
          let description = `Бригада "${crewData.name}" назначена`;
          if (membersList) {
            description += ` (участники: ${membersList})`;
          }
          
          // Добавляем запись в историю о создании снепшота
          await storage.createProjectHistoryEntry({
            projectId: project.id,
            userId,
            changeType: 'assignment_change',
            fieldName: 'crew',
            oldValue: null,
            newValue: `Бригада назначена (ID: ${project.crewId})`,
            description,
            crewSnapshotId: snapshot.id,
          });
          
          console.log(`Crew snapshot created successfully: ${snapshot.id}`);
        } catch (snapshotError) {
          console.error('Failed to create crew snapshot:', snapshotError);
          // Не блокируем создание проекта, если снепшот не удался
        }
      }
      
      console.log('Project created successfully:', project);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ message: "Failed to create project", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/projects/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const updateData = req.body;
      const project = await storage.updateProject(projectId, updateData);
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // DELETE /api/projects/:id - удалить проект и все связанные данные
  app.delete('/api/projects/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const user = await storage.getUser(req.user.id);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Только администраторы могут удалять проекты" });
      }

      // Удаляем связанные данные в правильном порядке
      await db.delete(reclamationHistory).where(
        inArray(reclamationHistory.reclamationId,
          db.select({ id: reclamations.id }).from(reclamations).where(eq(reclamations.projectId, projectId))
        )
      );
      await db.delete(reclamations).where(eq(reclamations.projectId, projectId));
      await db.delete(projectShares).where(eq(projectShares.projectId, projectId));
      await db.delete(projectHistory).where(eq(projectHistory.projectId, projectId));
      await db.delete(projectFiles).where(eq(projectFiles.projectId, projectId));
      await db.delete(projectReports).where(eq(projectReports.projectId, projectId));
      await db.delete(projectCrewSnapshots).where(eq(projectCrewSnapshots.projectId, projectId));
      await db.delete(projectNotes).where(eq(projectNotes.projectId, projectId));
      // Отвязываем CraftOS appointment
      await db.update(craftosAppointments).set({ projectId: null }).where(eq(craftosAppointments.projectId, projectId));
      // Удаляем сам проект
      await db.delete(projects).where(eq(projects.id, projectId));

      res.json({ message: "Проект удалён" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Ошибка удаления проекта" });
    }
  });

  app.patch('/api/projects/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const updateData = req.body;
      const userId = req.user.id;
      
      // Проверяем роль пользователя, если статус меняется на 'paid'
      if (updateData.status === 'paid') {
        const user = await storage.getUser(userId);
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: "Только администраторы могут отмечать счета как оплаченные" });
        }
      }
      
      // Получаем данные проекта до изменения для истории
      const currentProject = await storage.getProjectById(projectId);
      
      // Обновляем проект
      const project = await storage.updateProject(projectId, updateData);
      
      // Логируем изменения в истории
      for (const [key, newValue] of Object.entries(updateData)) {
        const oldValue = currentProject ? (currentProject as any)[key] : null;
        
        if (oldValue !== newValue) {
          let description = '';
          let changeType = 'info_update';
          let crewSnapshotId: number | null = null;
          
          if (key === 'status') {
            changeType = 'status_change';
            const statusLabels: any = {
              'planning': 'Планирование',
              'equipment_waiting': 'Ожидание оборудования',
              'equipment_arrived': 'Оборудование поступило',
              'work_scheduled': 'Работы запланированы',
              'work_in_progress': 'Работы в процессе',
              'work_completed': 'Работы завершены',
              'invoiced': 'Счет выставлен',
              'send_invoice': 'Отправить счет клиенту',
              'invoice_sent': 'Счет отправлен',
              'paid': 'Оплачено',
              'done': 'Завершено'
            };
            description = `Статус изменен с "${statusLabels[oldValue] || oldValue}" на "${statusLabels[newValue] || newValue}"`;
          } else if (key === 'equipmentExpectedDate' || key === 'equipmentArrivedDate') {
            changeType = 'equipment_update';
            description = key === 'equipmentExpectedDate'
              ? `Дата ожидания оборудования изменена на ${new Date(newValue as string).toLocaleDateString('ru-RU')}`
              : `Дата поступления оборудования изменена на ${new Date(newValue as string).toLocaleDateString('ru-RU')}`;
          } else if (key === 'workStartDate' || key === 'workEndDate') {
            changeType = 'date_update';
            description = key === 'workStartDate'
              ? `Дата начала работ изменена на ${new Date(newValue as string).toLocaleDateString('ru-RU')}`
              : `Дата окончания работ изменена на ${new Date(newValue as string).toLocaleDateString('ru-RU')}`;
          } else if (key === 'needsCallForEquipmentDelay' || key === 'needsCallForCrewDelay' || key === 'needsCallForDateChange') {
            changeType = 'call_update';
            description = newValue 
              ? `Требуется звонок клиенту`
              : `Звонок клиенту больше не требуется`;
          } else if (key === 'crewId') {
            changeType = 'assignment_change';
            description = `Команда назначена`;
            
            // Создаем снимок состава бригады при назначении
            if (newValue && newValue !== oldValue) {
              try {
                const snapshot = await storage.createProjectCrewSnapshot(projectId, parseInt(String(newValue)), userId);
                console.log(`Crew snapshot created for project ${projectId}, crew ${newValue}`);
                
                // Получаем информацию о бригаде и участниках из снепшота
                const crewData = snapshot.crewData as any;
                const membersData = snapshot.membersData as any[];
                
                // Формируем список участников для отображения
                let membersList = '';
                if (membersData && membersData.length > 0) {
                  const memberNames = membersData.map(member => 
                    `${member.firstName || ''} ${member.lastName || ''}`.trim()
                  ).filter(name => name.length > 0);
                  
                  if (memberNames.length > 0) {
                    membersList = memberNames.join(', ');
                  }
                }
                
                // Обновляем описание с именами участников и сохраняем ID снимка
                description = `Бригада "${crewData.name}" назначена`;
                if (membersList) {
                  description += ` (участники: ${membersList})`;
                }
                crewSnapshotId = snapshot.id;

                // Генерируем токен для загрузки фотографий бригадой
                try {
                  const uploadToken = await storage.generateCrewUploadToken(projectId);
                  console.log(`Crew upload token generated for project ${projectId}: ${uploadToken}`);
                } catch (tokenError) {
                  console.warn(`Failed to generate crew upload token:`, tokenError);
                }
              } catch (snapshotError) {
                console.warn(`Failed to create crew snapshot:`, snapshotError);
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
            crewSnapshotId,
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
  app.get('/api/services', authenticateSupabase, async (req: any, res) => {
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

  app.post('/api/services', authenticateSupabase, async (req: any, res) => {
    try {
      // Кастомная схема для API которая принимает строки для price и quantity
      const serviceApiSchema = insertServiceSchema.extend({
        price: z.union([z.string(), z.number()]).transform(val => val.toString()),
        quantity: z.union([z.string(), z.number()]).transform(val => val.toString()),
      });
      
      const serviceData = serviceApiSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
      if (userId && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Добавлена новая услуга: ${service.description || service.productKey}`,
        });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch('/api/services/:id', authenticateSupabase, async (req: any, res) => {
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
      const userId = req.user.id;
      if (userId && service && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Изменена услуга: ${service.description || service.productKey}`,
        });
      }
      
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      
      // Получаем данные услуги перед удалением для истории
      const service = await storage.getServiceById(serviceId);
      
      await storage.deleteService(serviceId);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
      if (userId && service && service.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: service.projectId,
          userId,
          changeType: 'info_update',
          description: `Удалена услуга: ${service.description || service.productKey}`,
        });
      }
      
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Project status management routes
  app.patch('/api/projects/:id/status', authenticateSupabase, async (req: any, res) => {
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
      const userId = req.user.id;
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
  app.get('/api/users', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  app.post('/api/users', authenticateSupabase, isAdmin, async (req: any, res) => {
    try {
      const { email, firstName, lastName, role, firmIds, password } = req.body;

      // Validate required fields
      if (!email || !firstName || !lastName || !role) {
        return res.status(400).json({
          message: "Missing required fields: email, firstName, lastName, role"
        });
      }

      // Validate role
      if (role !== 'admin' && role !== 'leiter') {
        return res.status(400).json({
          message: "Invalid role. Must be 'admin' or 'leiter'"
        });
      }

      // Password is required for leiter role
      if (role === 'leiter' && !password) {
        return res.status(400).json({
          message: "Password is required for leiter role"
        });
      }

      // Validate password length
      if (password && password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters"
        });
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: role === 'leiter' ? password : undefined,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        }
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return res.status(400).json({
          message: `Failed to create user: ${authError.message}`
        });
      }

      if (!authData.user) {
        return res.status(500).json({
          message: "Failed to create user: No user data returned"
        });
      }

      // Create profile in database
      const profile = await storage.upsertUser({
        id: authData.user.id,
        email,
        firstName,
        lastName,
        role,
      });

      // Assign user to firms if role is leiter and firmIds are provided
      if (role === 'leiter' && firmIds && Array.isArray(firmIds) && firmIds.length > 0) {
        for (const firmId of firmIds) {
          await storage.assignUserToFirm(authData.user.id, firmId);
        }
      }

      console.log(`Created user ${email} with role ${role}`);
      res.json(profile);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Update user
  app.patch('/api/users/:id', authenticateSupabase, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, firmIds } = req.body;

      // Get existing user
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Update profile in database
      const profile = await storage.upsertUser({
        id,
        email: existingUser.email,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        role: role || existingUser.role,
      });

      // Update firm assignments if role is leiter
      if (role === 'leiter' && firmIds !== undefined) {
        // Get current firm assignments
        const currentFirms = await storage.getFirmsByUserId(id);
        const currentFirmIds = currentFirms.map(f => String(f.id));

        // Remove user from firms not in the new list
        for (const currentFirmId of currentFirmIds) {
          if (!firmIds.includes(currentFirmId)) {
            await storage.removeUserFromFirm(id, currentFirmId);
          }
        }

        // Add user to new firms
        for (const firmId of firmIds) {
          if (!currentFirmIds.includes(firmId)) {
            await storage.assignUserToFirm(id, firmId);
          }
        }
      } else if (role === 'admin') {
        // If user becomes admin, remove all firm assignments
        const currentFirms = await storage.getFirmsByUserId(id);
        for (const firm of currentFirms) {
          await storage.removeUserFromFirm(id, String(firm.id));
        }
      }

      console.log(`Updated user ${id} with role ${role}`);
      res.json(profile);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Reset password for leiter
  app.post('/api/users/:id/reset-password', authenticateSupabase, isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      // Validate password
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters"
        });
      }

      // Check if user exists and is a leiter
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== 'leiter') {
        return res.status(400).json({
          message: "Password reset is only available for leiter users"
        });
      }

      // Reset password via Supabase Admin API
      const { error } = await supabase.auth.admin.updateUserById(id, {
        password: newPassword
      });

      if (error) {
        console.error("Error resetting password:", error);
        return res.status(500).json({
          message: `Failed to reset password: ${error.message}`
        });
      }

      console.log(`Password reset for user ${id} by admin ${req.user.id}`);
      res.json({ success: true, message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Invoice routes
  app.get('/api/invoices/:firmId', authenticateSupabase, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admins can view invoices
      if (user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Only administrators can view invoices." });
      }
      
      const invoices = await storage.getInvoicesByFirmId(firmId);
      
      console.log(`Found ${invoices.length} invoices for firm ${firmId}`);
      console.log('Sample invoice statuses:', invoices.slice(0, 5).map(inv => ({ 
        number: inv.invoiceNumber, 
        status: inv.status, 
        isPaid: inv.isPaid 
      })));
      
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Statistics routes
  app.get('/api/stats/:firmId', authenticateSupabase, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user.id;
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
  // Download invoice PDF and add to project files
  app.post('/api/invoice/download-pdf/:projectId', authenticateSupabase, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
      
      // Get project directly from database using SQL
      const projectResult = await db.select().from(projects).where(eq(projects.id, parseInt(projectId)));
      const project = projectResult[0];
      if (!project) {
        return res.status(404).json({ message: 'Проект не найден' });
      }
      
      if (!project.invoiceNumber) {
        return res.status(400).json({ message: 'У проекта нет счета для скачивания' });
      }
      
      // Если у проекта есть прямая ссылка на Invoice Ninja, извлечем ID из неё
      let invoiceId = null;
      if (project.invoiceUrl && project.invoiceUrl.includes('invoices/')) {
        const urlParts = project.invoiceUrl.split('invoices/');
        if (urlParts.length > 1) {
          invoiceId = urlParts[1]; // Получаем ID из URL
          console.log(`Extracted invoice ID from URL: ${invoiceId}`);
        }
      }
      
      console.log(`Processing PDF download for project ${projectId}, invoice ${project.invoiceNumber}`);
      
      // Get firm for Invoice Ninja credentials  
      const firm = await storage.getFirmById(String(project.firmId));
      
      if (!firm || !firm.token || !firm.invoiceNinjaUrl) {
        return res.status(400).json({ message: 'Настройки Invoice Ninja не найдены' });
      }
      
      console.log(`Firm found: ${firm.name}, URL: ${firm.invoiceNinjaUrl}, token: ${firm.token ? 'present' : 'missing'}`);
      
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      
      // Скачиваем реальный PDF из Invoice Ninja
      console.log(`Attempting to download PDF for invoice: ${project.invoiceNumber}`);

      let pdfBuffer: Buffer;
      try {
        let invoice = null;

        // Если у нас есть ID из URL, используем его напрямую
        if (invoiceId) {
          console.log(`Using invoice ID from URL: ${invoiceId}`);
          invoice = { id: invoiceId, number: project.invoiceNumber };
        } else {
          // Получаем ID счета из Invoice Ninja
          const invoices = await invoiceNinja.getInvoices();
          console.log(`Looking for invoice number: ${project.invoiceNumber}`);

          // Пробуем найти счет по разным полям
          invoice = invoices.find((inv: any) => inv.number === project.invoiceNumber);
          if (!invoice) {
            invoice = invoices.find((inv: any) => inv.invoice_number === project.invoiceNumber);
          }
          if (!invoice) {
            // Пробуем найти по частичному совпадению номера
            invoice = invoices.find((inv: any) =>
              (inv.number && inv.number.includes(project.invoiceNumber)) ||
              (inv.invoice_number && inv.invoice_number.includes(project.invoiceNumber))
            );
          }

          if (!invoice) {
            console.log('Available invoice numbers:', invoices.map((inv: any) => inv.number || inv.invoice_number).slice(0, 10));
            throw new Error(`Invoice ${project.invoiceNumber} not found in Invoice Ninja. Available invoices: ${invoices.slice(0, 5).map((inv: any) => inv.number || inv.invoice_number).join(', ')}`);
          }
        }

        console.log(`Found invoice in Invoice Ninja: ${invoice.id}, number: ${invoice.number || project.invoiceNumber}`);

        // Скачиваем PDF счета
        pdfBuffer = await invoiceNinja.downloadInvoicePDF(invoice.id);

        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('PDF download returned empty buffer');
        }

        console.log(`Downloaded PDF buffer, size: ${pdfBuffer.length} bytes`);
      } catch (downloadError: any) {
        console.error('Failed to download PDF from Invoice Ninja:', downloadError.message);
        throw new Error(`PDF download failed: ${downloadError.message}`);
      }

      // Save PDF to Supabase Storage
      const pdfMetadata = await fileStorageService.saveFile(
        pdfBuffer,
        `invoice_${project.invoiceNumber}.pdf`,
        'application/pdf',
        'invoice',
        parseInt(projectId)
      );

      console.log(`PDF saved to Supabase Storage: ${pdfMetadata.storagePath}, size: ${pdfBuffer.length} bytes`);

      // Add to project files in database (legacy table with required fileUrl)
      const fileRecord = await storage.createFile({
        projectId: parseInt(projectId),
        fileUrl: `/api/files/download/${pdfMetadata.fileName}`, // Используем API URL для совместимости
        fileName: pdfMetadata.fileName,
        fileType: 'application/pdf'
      });
      
      // Add history entry
      await storage.createProjectHistoryEntry({
        projectId: parseInt(projectId),
        userId: userId,
        changeType: 'file_added',
        description: `Скачан PDF счета ${project.invoiceNumber}`,
        oldValue: null,
        newValue: pdfMetadata.fileName
      });
      

      
      res.json({ 
        success: true, 
        message: `PDF счета ${project.invoiceNumber} успешно скачан и добавлен в файлы проекта`,
        file: fileRecord
      });
      
    } catch (error: any) {
      console.error('Error downloading invoice PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/invoice/create', authenticateSupabase, async (req: any, res) => {
    try {
      console.log('Invoice creation request:', req.body);
      const { projectId } = req.body;
      const userId = req.user.id;
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
      const userFirms = await storage.getFirmsByUserId(req.user.id);
      console.log(`User firms: [${userFirms.map(f => `${f.id}(${f.name})`).join(', ')}], project.firmId: ${project.firmId}`);
      const firm = userFirms.find(f => f.id === project.firmId);

      if (!firm) {
        return res.status(404).json({ message: `Firm not found. User has access to firms: [${userFirms.map(f => f.id).join(',')}], project needs firmId: ${project.firmId}` });
      }

      const client = await storage.getClientsByFirmId(String(firm.id));
      const projectClient = client.find(c => c.id === project.clientId);
      
      if (!projectClient) {
        return res.status(404).json({ message: "Client not found" });
      }

      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      
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

  // Test SMTP connection
  app.post('/api/smtp/test', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Access denied" });
      }

      const { host, port, smtpUser, password, secure, fromEmail, testEmail } = req.body;

      if (!host || !fromEmail) {
        return res.status(400).json({ message: "SMTP host and from email are required" });
      }

      const recipientEmail = testEmail || user.email || fromEmail;

      const smtp = new SmtpService({
        host,
        port: parseInt(port) || 587,
        user: smtpUser || '',
        password: password || '',
        secure: secure || false,
      });
      await smtp.sendTestEmail(fromEmail, recipientEmail);

      res.json({
        success: true,
        email: recipientEmail,
        message: `Тестовое письмо отправлено на ${recipientEmail}`
      });
    } catch (error: any) {
      console.error("Error testing SMTP:", error);
      res.status(400).json({
        message: error.message || "Failed to send test email"
      });
    }
  });

  // Send invoice by email
  app.post('/api/invoice/send-email/:projectId', authenticateSupabase, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;
      
      const project = await storage.getProjectById(parseInt(projectId));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.invoiceNumber) {
        return res.status(400).json({ message: "Project doesn't have an invoice" });
      }

      // Get firm details
      const firm = await storage.getFirmById(String(project.firmId));
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      if (!firm.smtpHost || !firm.smtpFrom) {
        return res.status(400).json({ message: "SMTP не настроен для этой фирмы" });
      }

      // Get client details
      const client = await storage.getClientById(project.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ message: "У клиента не указан email" });
      }

      // Get invoice details
      const invoice = await storage.getInvoiceByProjectId(parseInt(projectId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found in database" });
      }

      // Try to get PDF file from storage
      let pdfBase64: string | undefined;

      // First check new file_storage table
      const storageFiles = await storage.getProjectFiles(parseInt(projectId));
      console.log(`Storage files for project ${projectId}:`, storageFiles.map(f => f.originalName));
      const storagePdf = storageFiles.find(f =>
        (f.originalName?.toLowerCase().includes('invoice') || f.category === 'invoice') &&
        f.mimeType === 'application/pdf'
      );

      if (storagePdf) {
        try {
          console.log(`Trying to read PDF from storage: ${storagePdf.fileName}`);
          const pdfBuffer = await fileStorageService.getFile(storagePdf.fileName);
          pdfBase64 = pdfBuffer.toString('base64');
          console.log(`Successfully read PDF file, size: ${pdfBuffer.length} bytes`);
        } catch (error) {
          console.error('Error reading PDF from storage:', error);
        }
      }

      // Fallback to legacy project_files table
      if (!pdfBase64) {
        const legacyFiles = await storage.getFilesByProjectId(parseInt(projectId));
        console.log(`Legacy files for project ${projectId}:`, legacyFiles.map(f => f.fileName));
        const legacyPdf = legacyFiles.find(f => f.fileName?.includes('invoice') && f.fileName?.endsWith('.pdf'));

        if (legacyPdf && legacyPdf.fileName) {
          try {
            console.log(`Trying to read legacy PDF: ${legacyPdf.fileName}`);
            const pdfBuffer = await fileStorageService.getFile(legacyPdf.fileName);
            pdfBase64 = pdfBuffer.toString('base64');
            console.log(`Successfully read legacy PDF, size: ${pdfBuffer.length} bytes`);
          } catch (error) {
            console.error('Error reading legacy PDF:', error);
          }
        } else {
          console.log('No PDF file found for invoice in any table');
        }
      }

      // Prepare template variables
      const formattedAmount = new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
      }).format(Number(invoice.totalAmount));

      const templateVars: Record<string, string> = {
        invoiceNumber: project.invoiceNumber || '',
        firmName: firm.name,
        clientName: client.name,
        amount: formattedAmount,
        totalAmount: formattedAmount,
        dueDate: invoice.dueDate || '',
        invoiceDate: invoice.invoiceDate || '',
      };

      // Replace template variables
      const processTemplate = (template: string) => {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
          return templateVars[key] || match;
        });
      };

      const subject = processTemplate(firm.emailSubjectTemplate || 'Счет №{{invoiceNumber}} от {{firmName}}');
      const htmlBody = processTemplate(firm.emailBodyTemplate || 'Уважаемый {{clientName}},\n\nВо вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.\n\nС уважением,\n{{firmName}}').replace(/\n/g, '<br>');

      // Send email with SMTP
      const smtp = new SmtpService({
        host: firm.smtpHost,
        port: parseInt(firm.smtpPort || '587'),
        user: firm.smtpUser || '',
        password: firm.smtpPassword || '',
        secure: firm.smtpSecure || false,
      });
      const attachments = pdfBase64 ? [{
        name: `invoice_${project.invoiceNumber}.pdf`,
        content: pdfBase64,
        contentType: 'application/pdf',
      }] : undefined;

      await smtp.sendEmail({
        from: firm.smtpFrom,
        to: client.email,
        subject,
        htmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${htmlBody}</div>`,
        textBody: processTemplate(firm.emailBodyTemplate || 'Уважаемый {{clientName}},\n\nВо вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.\n\nС уважением,\n{{firmName}}'),
        attachments,
      });

      // Update project status
      await storage.updateProjectStatus(parseInt(projectId), 'invoice_sent');

      // Add history entry
      await storage.createProjectHistoryEntry({
        projectId: parseInt(projectId),
        userId,
        changeType: 'status_change',
        description: `Счет отправлен на email ${client.email}`,
        oldValue: project.status,
        newValue: 'invoice_sent'
      });

      res.json({ 
        success: true, 
        message: `Счет успешно отправлен на ${client.email}` 
      });
    } catch (error: any) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ 
        message: error.message || "Failed to send invoice email" 
      });
    }
  });

  // DEPRECATED: Generate crew upload token endpoint
  // This endpoint is deprecated in favor of the Worker Portal with PIN authentication
  // Workers should now use /worker/login with their email and PIN
  app.post('/api/generate-crew-token/:projectId', authenticateSupabase, async (req: any, res) => {
    // Return deprecation notice instead of generating token
    res.status(410).json({
      message: "Эта функция устарела. Теперь работники используют Портал Работника с PIN-аутентификацией.",
      deprecated: true,
      replacement: "/worker/login"
    });
  });

  // DEPRECATED: Crew Upload API endpoints
  // These endpoints are deprecated in favor of the Worker Portal with PIN authentication
  app.get('/api/crew-upload/:projectId/:token/validate', async (req: any, res) => {
    res.status(410).json({
      valid: false,
      deprecated: true,
      message: 'Эта ссылка больше не работает. Используйте Портал Работника с PIN-аутентификацией.',
      replacement: "/worker/login"
    });
  });

  // DEPRECATED: validate-email endpoint
  app.post('/api/crew-upload/:projectId/:token/validate-email', async (req: any, res) => {
    res.status(410).json({
      valid: false,
      deprecated: true,
      message: 'Эта функция устарела. Используйте Портал Работника с PIN-аутентификацией.',
      replacement: "/worker/login"
    });
  });

  // DEPRECATED: upload endpoint
  app.post('/api/crew-upload/:projectId/:token/upload', async (req: any, res) => {
    res.status(410).json({
      success: false,
      deprecated: true,
      message: 'Эта функция устарела. Используйте Портал Работника с PIN-аутентификацией.',
      replacement: "/worker/login"
    });
  });

  // Invoice Ninja catalog routes
  app.get('/api/catalog/products', authenticateSupabase, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }

      const userId = req.user.id;
      const firms = await storage.getFirmsByUserId(userId);
      const firm = firms.find(f => f.id === Number(firmId));
      
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const products = await invoiceNinja.getProducts();
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching catalog products:", error);
      res.status(500).json({ message: "Failed to fetch catalog products" });
    }
  });

  // Project Files routes
  app.get('/api/projects/:id/files', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const files = await storage.getFilesByProjectId(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching project files:", error);
      res.status(500).json({ message: "Failed to fetch project files" });
    }
  });

  app.post('/api/projects/:id/files', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const fileData = insertProjectFileSchema.parse({
        ...req.body,
        projectId,
      });
      
      const file = await storage.createFile(fileData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
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



  // Project Reports routes
  app.get('/api/projects/:id/reports', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
      }
      const reports = await storage.getReportsByProjectId(projectId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching project reports:", error);
      res.status(500).json({ message: "Failed to fetch project reports" });
    }
  });

  app.post('/api/projects/:id/reports', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const reportData = insertProjectReportSchema.parse({
        ...req.body,
        projectId,
      });
      
      const report = await storage.createReport(reportData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
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

  app.patch('/api/reports/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const updateData = req.body;
      const report = await storage.updateReport(reportId, updateData);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
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

  app.delete('/api/reports/:id', authenticateSupabase, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      
      // Получаем данные отчета перед удалением для истории
      const report = await storage.getReportById(reportId);
      
      await storage.deleteReport(reportId);
      
      // Добавляем запись в историю проекта
      const userId = req.user.id;
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
  app.get('/api/stats', authenticateSupabase, async (req: any, res) => {
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
  app.get('/api/project-history/:projectId', authenticateSupabase, async (req: any, res) => {
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
  app.get('/api/projects/:projectId/notes', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);

      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      if (!(await requireProjectAccess(req, projectId))) {
        return res.status(403).json({ message: "Access denied" });
      }

      const notes = await db.select().from(projectNotes).where(eq(projectNotes.projectId, projectId));

      res.json(notes);
    } catch (error) {
      console.error("Ошибка получения примечаний проекта:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post('/api/projects/:projectId/notes', authenticateSupabase, async (req: any, res) => {
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
  app.post('/api/projects/:projectId/share', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      const userId = req.user.id;
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

  app.get('/api/projects/:projectId/shares', authenticateSupabase, async (req: any, res) => {
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

  app.delete('/api/projects/:projectId/shares/:userId', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const { userId } = req.params;
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Неверный ID проекта" });
      }

      const currentUserId = req.user.id;
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

  // Project Reclamation routes (создание рекламации для проекта)
  app.post('/api/projects/:projectId/reclamation', authenticateSupabase, async (req: any, res) => {
    const { createReclamationSchema } = await import("@shared/schema");

    console.log("POST /api/projects/:projectId/reclamation called with projectId:", req.params.projectId);
    console.log("Request body:", req.body);

    try {
      const user = req.user!;
      const projectId = parseInt(req.params.projectId);

      // Проверка роли (только admin и leiter)
      if (user.role !== 'admin' && user.role !== 'leiter') {
        return res.status(403).json({ error: "Only admin and leiter can create reclamations" });
      }

      // Валидация данных
      const validatedData = createReclamationSchema.parse(req.body);

      // Получаем проект
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Проверка что проект завершён
      const allowedStatuses = ['work_completed', 'invoiced', 'send_invoice', 'invoice_sent', 'paid'];
      if (!allowedStatuses.includes(project.status)) {
        return res.status(400).json({
          error: "Reclamation can only be created for completed projects",
          currentStatus: project.status
        });
      }

      // Проверка что бригада существует
      const crew = await storage.getCrewById(validatedData.crewId);
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }

      // Создаём рекламацию
      const reclamation = await storage.createReclamation({
        projectId,
        firmId: project.firmId,
        description: validatedData.description,
        deadline: validatedData.deadline,
        crewId: validatedData.crewId,
        createdBy: user.id,
      });

      // Обновляем статус проекта
      await storage.updateProjectStatus(projectId, 'reclamation');

      // Добавляем запись в историю проекта
      await storage.createProjectHistoryEntry({
        projectId,
        userId: user.id,
        changeType: 'status_change',
        fieldName: 'status',
        oldValue: project.status,
        newValue: 'reclamation',
        description: `Создана рекламация: ${validatedData.description}`,
      });

      res.status(201).json(reclamation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error creating reclamation:", error);
      res.status(500).json({ error: "Failed to create reclamation" });
    }
  });

  // GET /api/projects/:projectId/reclamations - Рекламации проекта
  app.get('/api/projects/:projectId/reclamations', authenticateSupabase, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const reclamations = await storage.getReclamationsByProjectId(projectId);
      res.json(reclamations);
    } catch (error) {
      console.error("Error getting project reclamations:", error);
      res.status(500).json({ error: "Failed to get project reclamations" });
    }
  });

  // Firm-User management endpoints
  app.get('/api/firms/:firmId/users', authenticateSupabase, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Проверяем доступ пользователя к фирме
      if (user.role !== 'admin') {
        const hasAccess = await storage.hasUserFirmAccess(userId, firmId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const users = await storage.getUsersByFirmId(firmId);
      res.json(users);
    } catch (error) {
      console.error("Ошибка получения пользователей фирмы:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.post('/api/firms/:firmId/users/:userId', authenticateSupabase, isAdmin, async (req: any, res) => {
    try {
      const { firmId, userId } = req.params;
      
      await storage.assignUserToFirm(userId, firmId);
      res.json({ success: true, message: "Пользователь добавлен в фирму" });
    } catch (error) {
      console.error("Ошибка добавления пользователя в фирму:", error);
      res.status(500).json({ error: "Ошибка сервера" });
    }
  });

  app.delete('/api/firms/:firmId/users/:userId', authenticateSupabase, isAdmin, async (req: any, res) => {
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
  app.get('/api/users-with-firms', authenticateSupabase, isAdmin, async (req: any, res) => {
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
  app.post('/api/invoices/sync-payment-status', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
        const firmInvoices = await storage.getInvoicesByFirmId(String(userFirm.id));
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
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(invoice.invoiceId);

      console.log(`Invoice ${invoiceNumber} payment status in Invoice Ninja:`, paymentStatus);

      // Update our database with both payment status and Invoice Ninja status
      const updateData: any = {};
      let needsUpdate = false;

      console.log(`Comparing statuses for invoice ${invoiceNumber}:`, {
        currentStatus: invoice.status,
        newStatus: paymentStatus.status,
        currentPaid: invoice.isPaid,
        newPaid: paymentStatus.isPaid
      });

      if (paymentStatus.isPaid !== invoice.isPaid) {
        updateData.isPaid = paymentStatus.isPaid;
        needsUpdate = true;
        console.log(`Payment status changed: ${invoice.isPaid} -> ${paymentStatus.isPaid}`);
      }

      if (paymentStatus.status && paymentStatus.status !== invoice.status) {
        updateData.status = paymentStatus.status;
        needsUpdate = true;
        console.log(`Status changed: '${invoice.status}' -> '${paymentStatus.status}'`);
      }

      if (needsUpdate) {
        console.log(`Updating invoice ${invoiceNumber} with data:`, updateData);
        await storage.updateInvoice(invoice.id, updateData);

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

        console.log(`Successfully updated invoice ${invoiceNumber}: payment=${paymentStatus.isPaid}, status=${paymentStatus.status}`);
      } else {
        console.log(`No update needed for invoice ${invoiceNumber}`);
      }

      res.json({ 
        success: true, 
        updated: needsUpdate,
        isPaid: paymentStatus.isPaid,
        statusId: paymentStatus.statusId,
        status: paymentStatus.status
      });

    } catch (error) {
      console.error("Error syncing invoice payment status:", error);
      res.status(500).json({ message: "Failed to sync payment status", error: error.message });
    }
  });

  // Синхронизация всех счетов фирмы с Invoice Ninja
  app.post('/api/invoices/sync-all-payment-status/:firmId', authenticateSupabase, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firmId } = req.params;
      
      // Verify user has access to this firm
      const userFirms = await storage.getFirmsByUserId(userId);
      const firm = userFirms.find(f => f.id === firmId);
      
      if (!firm) {
        return res.status(403).json({ message: "Access denied to this firm" });
      }

      const invoices = await storage.getInvoicesByFirmId(firmId);
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      
      let updatedCount = 0;
      const results = [];

      for (const invoice of invoices) {
        if (!invoice.invoiceId) {
          results.push({ invoiceNumber: invoice.invoiceNumber, status: 'no_ninja_id' });
          continue;
        }

        try {
          const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(invoice.invoiceId);
          
          // Update both payment status and Invoice Ninja status
          const updateData: any = {};
          let needsUpdate = false;

          if (paymentStatus.isPaid !== invoice.isPaid) {
            updateData.isPaid = paymentStatus.isPaid;
            needsUpdate = true;
          }

          if (paymentStatus.status && paymentStatus.status !== invoice.status) {
            updateData.status = paymentStatus.status;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await storage.updateInvoice(invoice.id, updateData);
            
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
              isPaid: paymentStatus.isPaid,
              invoiceStatus: paymentStatus.status
            });
          } else {
            results.push({ 
              invoiceNumber: invoice.invoiceNumber, 
              status: 'no_change', 
              isPaid: invoice.isPaid,
              invoiceStatus: invoice.status
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
