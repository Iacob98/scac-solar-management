import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { InvoiceNinjaService } from "./services/invoiceNinja";
import { 
  insertFirmSchema, 
  insertClientSchema, 
  insertCrewSchema, 
  insertCrewMemberSchema,
  insertProjectSchema, 
  insertServiceSchema,
  insertProjectFileSchema,
  insertProjectReportSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

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

  // Invoice routes  
  app.post('/api/invoice/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { projectId } = z.object({
        projectId: z.number(),
      }).parse(req.body);

      // Get project with all related data
      const project = await storage.getProjectById(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get firm info for Invoice Ninja API
      const firms = await storage.getFirms();
      const firm = firms.find(f => f.id === project.firmId);
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      // Get client info
      const clients = await storage.getClientsByFirmId(project.firmId);
      const client = clients.find(c => c.id === project.clientId);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }

      // Get services for the project
      const services = await storage.getServicesByProjectId(projectId);
      if (services.length === 0) {
        return res.status(400).json({ message: "No services found for project" });
      }

      // Create Invoice Ninja service instance
      const ninjaService = new InvoiceNinjaService(firm.invoiceNinjaUrl, firm.token);

      // Check if client exists in Invoice Ninja, create if not
      let ninjaClientId = client.ninjaClientId;
      if (!ninjaClientId) {
        const ninjaClient = await ninjaService.createClient({
          name: client.name,
          email: client.email || '',
          phone: client.phone || '',
          address1: client.address || '',
          country_id: "276", // Germany
        });
        ninjaClientId = ninjaClient.id;
        
        // Update our client with the ninja_client_id
        await storage.updateClient(client.id, { ninjaClientId });
      }

      // Create invoice in Invoice Ninja (German format)
      const invoiceData = {
        client_id: ninjaClientId,
        line_items: services.map(service => ({
          quantity: Number(service.quantity) || 1,
          cost: parseFloat(service.price.toString()),
          product_key: service.productKey || service.description.split(' ')[0],
          notes: service.description,
          custom_value1: '',
          custom_value2: '',
        })),
        // German invoice format
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days
        public_notes: `Kundendaten: ${client.name}\nKundenanschrift: ${client.address}\nKundennummer: CLIENT-${client.id}`,
        private_notes: `Projekt ID: ${projectId}, Team: ${project.teamNumber || 'N/A'}`,
        custom_value1: `PROJ-${projectId}`,
        custom_value2: `CREW-${project.crewId || 'N/A'}`,
        // Add German tax settings
        tax_name1: 'USt.',
        tax_rate1: 0, // 0% as per German §13b UStG for B2B solar installations
        footer: 'Umsatzsteuerfreie Leistungen gemäß §13b Abs. 2 UStG.\nVielen Dank für die gute Zusammenarbeit.',
      };

      const invoice = await ninjaService.createInvoice(invoiceData);

      // Save invoice to our database
      const newInvoice = await storage.createInvoice({
        projectId: projectId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceDate: invoice.date,
        dueDate: invoice.due_date,
        totalAmount: invoice.amount.toString(),
        isPaid: false,
      });

      // Get PDF link from Invoice Ninja
      const pdfUrl = await ninjaService.downloadInvoicePDF ? 
        `/api/v1/invoices/${invoice.id}/download` : '';

      // Update project status
      await storage.updateProject(projectId, {
        status: 'invoiced',
        invoiceNumber: invoice.number,
        invoiceUrl: pdfUrl,
      });

      res.json({
        success: true,
        invoice: newInvoice,
        invoiceNumber: invoice.number,
        invoiceUrl: pdfUrl,
        totalAmount: invoice.amount,
      });

    } catch (error: any) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: error?.message || "Failed to create invoice" });
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

      // Find invoice in our database - we need to get all invoices first
      // and find the one matching the invoice number
      let invoice;
      if (user.role === 'admin') {
        // Admin can see all invoices
        const allInvoices = await storage.getInvoicesByFirmId(''); 
        invoice = allInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
      } else {
        // Non-admin users can only see invoices for their firms
        const userFirms = await storage.getFirmsByUserId(userId);
        for (const firm of userFirms) {
          const firmInvoices = await storage.getInvoicesByFirmId(firm.id);
          const foundInvoice = firmInvoices.find(inv => inv.invoiceNumber === invoiceNumber);
          if (foundInvoice) {
            invoice = foundInvoice;
            break;
          }
        }
      }
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found or access denied" });
      }

      // Update invoice as paid
      await storage.updateInvoice(invoice.id, { isPaid: true });

      // Update project status
      await storage.updateProject(invoice.projectId, { status: 'paid' });

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

  // Client routes
  app.get('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const firmId = req.query.firmId as string;
      if (!firmId) {
        return res.status(400).json({ message: "Firm ID is required" });
      }
      
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
      const client = await storage.getClientById(Number(id));
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post('/api/clients', isAuthenticated, async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(clientData);
      res.json(client);
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
      
      const crews = await storage.getCrewsByFirmId(firmId);
      res.json(crews);
    } catch (error) {
      console.error("Error fetching crews:", error);
      res.status(500).json({ message: "Failed to fetch crews" });
    }
  });

  app.get('/api/crews/single/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const crew = await storage.getCrewById(Number(id));
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
      await storage.archiveCrew(crewId);
      res.json({ message: "Crew archived successfully" });
    } catch (error) {
      console.error("Error archiving crew:", error);
      res.status(500).json({ message: "Failed to archive crew" });
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
      
      const projects = await storage.getProjectsByFirmId(firmId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('Creating project with data:', req.body);
      
      const projectData = insertProjectSchema.parse({
        ...req.body,
        leiterId: userId,
      });
      
      console.log('Parsed project data:', projectData);
      const project = await storage.createProject(projectData);
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
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      await storage.deleteService(serviceId);
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
      const { status } = z.object({
        status: z.enum(['planning', 'in_progress', 'done', 'invoiced', 'paid']),
      }).parse(req.body);

      const project = await storage.updateProject(id, { status });
      res.json(project);
    } catch (error) {
      console.error("Error updating project status:", error);
      res.status(500).json({ message: "Failed to update project status" });
    }
  });

  // Statistics routes
  app.get('/api/stats/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
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
      const { projectId } = req.body;
      
      if (!projectId) {
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
      
      // Create invoice in Invoice Ninja
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
        custom_value1: `PROJ-${projectId}`,
        custom_value2: project.crewId ? `CREW-${project.crewId}` : '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        public_notes: project.notes || '',
        private_notes: `Generated from SCAC Project ${projectId}`,
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

      // Update project status and invoice info
      await storage.updateProject(projectId, {
        status: 'invoiced',
        invoiceNumber: ninjaInvoice.number,
        invoiceUrl: `${firm.invoiceNinjaUrl}/invoices/${ninjaInvoice.id}`,
      });

      res.json({
        invoice,
        invoiceNumber: ninjaInvoice.number,
        invoiceUrl: `${firm.invoiceNinjaUrl}/invoices/${ninjaInvoice.id}`,
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch('/api/invoice/mark-paid', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceNumber } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can mark invoices as paid" });
      }

      // Find the invoice and update its status
      const invoices = await storage.getInvoicesByFirmId(req.query.firmId as string);
      const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await storage.updateInvoice(invoice.id, { isPaid: true });
      
      // Update project status
      await storage.updateProject(invoice.projectId, { status: 'paid' });

      res.json({ message: "Invoice marked as paid successfully" });
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid" });
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
      res.json(file);
    } catch (error) {
      console.error("Error creating project file:", error);
      res.status(500).json({ message: "Failed to create project file" });
    }
  });

  app.delete('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const fileId = parseInt(req.params.id);
      await storage.deleteFile(fileId);
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
      res.json(report);
    } catch (error) {
      console.error("Error updating report:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  app.delete('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      await storage.deleteReport(reportId);
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

  const httpServer = createServer(app);
  return httpServer;
}
