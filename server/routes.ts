/**
 * Файл: server/routes.ts
 * Назначение: Главный файл маршрутизации (рефакторинг 2025-07-24)
 * Используется в: server/index.ts
 * Зависимости: модули auth, firms, projects, crews, clients
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { InvoiceNinjaService } from "./services/invoiceNinja";
import { PostmarkService } from "./services/postmark";
import { db } from "./db";
import { firms, projects, projectHistory, projectNotes, fileStorage } from "@shared/schema";
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

// ----- Импорт новых модульных маршрутов -----
import { authRoutes } from './modules/auth';
import { firmsRoutes } from './modules/firms';
import { projectsRoutes } from './modules/projects';
import { crewsRoutes } from './modules/crews';
import { clientsRoutes } from './modules/clients';

// ----- Импорт существующих специализированных маршрутов -----
import fileRoutes from "./routes/fileRoutes";
import googleCalendarRoutes from "./routes/googleCalendar";
import emailNotificationRoutes from "./routes/emailNotifications";
import calendarDemoRoutes from "./routes/calendarDemo";
import googleRoutes from "./routes/google";
import { fileStorageService } from "./storage/fileStorage";
import { emailNotificationService } from "./services/emailNotifications";
import { googleCalendarService } from "./services/googleCalendar";
import fs from 'fs';
import path from 'path';

// Admin role check middleware
const isAdmin = async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
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

  // ----- Новые модульные маршруты (после рефакторинга 2025-07-24) -----
  app.use('/api/auth', authRoutes);
  app.use('/api/firms', firmsRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/crews', crewsRoutes);
  app.use('/api/clients', clientsRoutes);

  // ----- Существующие специализированные маршруты -----
  app.use('/api/files', fileRoutes);
  app.use('/api/google-calendar', googleCalendarRoutes);
  app.use('/api/google', googleRoutes);
  app.use('/api/notifications', emailNotificationRoutes);
  app.use('/api/calendar-demo', calendarDemoRoutes);

  // Test endpoint for history entries
  app.get('/api/test-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  // ===== СПЕЦИАЛИЗИРОВАННЫЕ API МАРШРУТЫ (НЕ ПЕРЕНЕСЕННЫЕ В МОДУЛИ) =====

  // Invoice management routes
  app.get('/api/invoices/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  // Services management routes
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
      const serviceApiSchema = insertServiceSchema.extend({
        price: z.union([z.string(), z.number()]).transform(val => val.toString()),
        quantity: z.union([z.string(), z.number()]).transform(val => val.toString()),
      });
      
      const serviceData = serviceApiSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      
      // Добавляем запись в историю проекта
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  app.patch('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      
      // Получаем данные услуги до изменения для истории
      const currentService = await storage.getServiceById(serviceId);
      
      const serviceApiSchema = insertServiceSchema.extend({
        price: z.union([z.string(), z.number()]).transform(val => val.toString()),
        quantity: z.union([z.string(), z.number()]).transform(val => val.toString()),
      }).partial();
      
      const serviceData = serviceApiSchema.parse(req.body);
      const service = await storage.updateService(serviceId, serviceData);
      
      // Добавляем запись в историю проекта об изменении
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const serviceId = parseInt(req.params.id);
      
      // Получаем данные услуги перед удалением для истории
      const service = await storage.getServiceById(serviceId);
      
      await storage.deleteService(serviceId);
      
      // Добавляем запись в историю проекта
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  app.post('/api/invoice/send-email/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;
      
      const project = await storage.getProjectById(parseInt(projectId));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (!project.invoiceNumber) {
        return res.status(400).json({ message: "Project doesn't have an invoice" });
      }

      // Get firm details
      const firm = await storage.getFirmById(project.firmId);
      if (!firm || !firm.postmarkServerToken || !firm.postmarkFromEmail) {
        return res.status(400).json({ message: "Postmark не настроен для этой фирмы" });
      }

      // Get client details
      const client = await storage.getClientById(project.clientId);
      if (!client || !client.email) {
        return res.status(400).json({ message: "У клиента не указан email" });
      }

      // Get invoice details
      const invoice = await storage.getInvoiceByProjectId(parseInt(projectId));
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found in database" });
      }

      // Create postmark service and send email
      const postmarkService = new PostmarkService(
        firm.postmarkServerToken,
        firm.postmarkFromEmail,
        firm.postmarkMessageStream || 'main'
      );

      await postmarkService.sendInvoiceEmail(
        client.email,
        client.firstName || 'Клиент',
        project.invoiceNumber || 'N/A',
        invoice.totalAmount?.toString() || '0',
        project
      );

      // Update project status to invoice_sent
      await storage.updateProject(parseInt(projectId), { status: 'invoice_sent' });

      // Add history entry
      await storage.createProjectHistoryEntry({
        projectId: parseInt(projectId),
        userId,
        changeType: 'status_change',
        fieldName: 'status',
        oldValue: 'invoiced',
        newValue: 'invoice_sent',
        description: `Счет №${project.invoiceNumber} отправлен на email ${client.email}`,
      });

      res.json({ 
        message: "Invoice sent successfully",
        email: client.email 
      });
    } catch (error) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ message: "Failed to send invoice email", error: error.message });
    }
  });



  // Invoice payment status synchronization routes
  app.post('/api/invoices/sync-payment-status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const { invoiceNumber, firmId } = z.object({
        invoiceNumber: z.string(),
        firmId: z.string(),
      }).parse(req.body);

      console.log(`🔄 Syncing payment status for invoice ${invoiceNumber} in firm ${firmId}`);

      const firm = await storage.getFirmById(firmId);
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(invoiceNumber);
      
      if (paymentStatus.isPaid) {
        console.log(`✅ Invoice ${invoiceNumber} is paid, updating project status`);
        
        // Find and update project
        const projects = await storage.getProjectsByFirmId(firmId);
        const project = projects.find(p => p.invoiceNumber === invoiceNumber);
        
        if (project) {
          await storage.updateProject(project.id, { status: 'paid' });
          
          // Create history entry
          await storage.createProjectHistoryEntry({
            projectId: project.id,
            userId,
            changeType: 'status_change',
            fieldName: 'status',
            oldValue: 'invoiced',
            newValue: 'paid',
            description: `Статус оплаты синхронизирован с Invoice Ninja - счет ${invoiceNumber} оплачен`,
          });
        }
      }

      res.json({ 
        success: true, 
        isPaid: paymentStatus.isPaid,
        invoiceNumber,
        projectId: paymentStatus.projectId 
      });
    } catch (error) {
      console.error("Error syncing payment status:", error);
      res.status(500).json({ message: "Failed to sync payment status" });
    }
  });

  app.post('/api/invoices/sync-all-payment-status/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;

      console.log(`🔄 Syncing all payment statuses for firm ${firmId}`);

      const firm = await storage.getFirmById(firmId);
      if (!firm) {
        return res.status(404).json({ message: 'Firm not found' });
      }

      // Get all invoiced projects for this firm
      const projects = await storage.getProjectsByFirmId(firmId);
      const invoicedProjects = projects.filter(p => p.status === 'invoiced' && p.invoiceNumber);
      
      console.log(`Found ${invoicedProjects.length} invoiced projects to check`);

      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      let updatedCount = 0;

      for (const project of invoicedProjects) {
        try {
          const paymentStatus = await invoiceNinja.checkInvoicePaymentStatus(project.invoiceNumber!);
          
          if (paymentStatus.isPaid) {
            console.log(`✅ Updating project ${project.id} - invoice ${project.invoiceNumber} is paid`);
            
            await storage.updateProject(project.id, { status: 'paid' });
            
            // Create history entry
            await storage.createProjectHistoryEntry({
              projectId: project.id,
              userId,
              changeType: 'status_change',
              fieldName: 'status',
              oldValue: 'invoiced',
              newValue: 'paid',
              description: `Автоматическая синхронизация - счет ${project.invoiceNumber} оплачен в Invoice Ninja`,
            });
            
            updatedCount++;
          }
        } catch (projectError: any) {
          console.warn(`⚠️ Failed to sync project ${project.id}: ${projectError.message}`);
        }
      }

      console.log(`✅ Sync completed: ${updatedCount} projects updated`);

      res.json({ 
        success: true, 
        message: `Payment status synced for ${updatedCount} projects`,
        updatedCount,
        totalChecked: invoicedProjects.length
      });
    } catch (error) {
      console.error("Error syncing all payment statuses:", error);
      res.status(500).json({ message: "Failed to sync payment statuses" });
    }
  });

  // Invoice payment status management
  app.patch('/api/invoice/mark-paid', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
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
        const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
        await invoiceNinja.markInvoiceAsPaid(invoice.invoiceId);
        console.log(`✅ Successfully marked Invoice Ninja invoice ${invoice.invoiceId} as paid`);
      } catch (ninjaError: any) {
        console.warn(`⚠️ Failed to mark invoice as paid in Invoice Ninja: ${ninjaError.message}`);
        // Continue with local update even if Invoice Ninja fails
      }

      // Update project status in local database
      await storage.updateProject(invoice.projectId, { status: 'paid' });
      
      // Create history entry
      await storage.createProjectHistoryEntry({
        projectId: invoice.projectId,
        userId,
        changeType: 'status_change',
        fieldName: 'status',
        oldValue: 'invoiced',
        newValue: 'paid',
        description: `Счет ${invoiceNumber} отмечен как оплаченный`,
      });

      res.json({ 
        success: true, 
        message: "Invoice marked as paid",
        projectId: invoice.projectId
      });
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ message: "Failed to mark invoice as paid" });
    }
  });

  // Send invoice via email using Postmark
  app.post('/api/invoice/send-email/:projectId', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get project details
      const project = await storage.getProjectById(Number(projectId));
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check access rights
      if (user.role !== 'admin' && project.leiterId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get firm and client details
      const firm = await storage.getFirmById(project.firmId);
      const client = await storage.getClientById(project.clientId);
      
      if (!firm || !client) {
        return res.status(404).json({ message: "Firm or client not found" });
      }

      if (!client.email) {
        return res.status(400).json({ message: "Client has no email address" });
      }

      // Check if firm has Postmark configuration
      if (!firm.postmarkServerToken || !firm.postmarkFromEmail) {
        return res.status(400).json({ message: "Postmark not configured for this firm" });
      }

      // Get invoice PDF from Invoice Ninja
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const pdfBuffer = await invoiceNinja.getInvoicePdf(project.invoiceNumber!);

      // Send email using Postmark
      const postmark = new PostmarkService(firm.postmarkServerToken);
      await postmark.sendInvoiceEmail({
        to: client.email,
        from: firm.postmarkFromEmail,
        messageStream: firm.postmarkMessageStream || 'outbound',
        clientName: client.name,
        projectId: project.id,
        invoiceNumber: project.invoiceNumber!,
        pdfBuffer,
        firmName: firm.name
      });

      // Update project status and create history entry
      await storage.updateProject(Number(projectId), { status: 'invoice_sent' });
      
      await storage.createProjectHistoryEntry({
        projectId: Number(projectId),
        userId,
        changeType: 'status_change',
        fieldName: 'status',
        oldValue: 'send_invoice',
        newValue: 'invoice_sent',
        description: `Счет ${project.invoiceNumber} отправлен клиенту ${client.name} на email ${client.email}`,
      });

      res.json({ 
        success: true, 
        message: "Invoice sent successfully",
        sentTo: client.email 
      });
    } catch (error) {
      console.error("Error sending invoice email:", error);
      res.status(500).json({ message: "Failed to send invoice email" });
    }
  });

  // Test Postmark email configuration
  app.post('/api/postmark/test', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId, testEmail } = z.object({
        firmId: z.string(),
        testEmail: z.string().email(),
      }).parse(req.body);

      const firm = await storage.getFirmById(firmId);
      if (!firm) {
        return res.status(404).json({ message: "Firm not found" });
      }

      if (!firm.postmarkServerToken || !firm.postmarkFromEmail) {
        return res.status(400).json({ message: "Postmark not configured" });
      }

      const postmark = new PostmarkService(firm.postmarkServerToken);
      await postmark.sendTestEmail({
        to: testEmail,
        from: firm.postmarkFromEmail,
        messageStream: firm.postmarkMessageStream || 'outbound',
        firmName: firm.name
      });

      res.json({ success: true, message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Services management (not moved to modules due to complex business logic)
  app.get('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = req.query.projectId;
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const services = await storage.getServicesByProjectId(Number(projectId));
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const serviceData = insertServiceSchema.parse(req.body);
      const service = await storage.createService(serviceData);
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const serviceData = req.body;
      
      const updatedService = await storage.updateService(Number(id), serviceData);
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteService(Number(id));
      res.json({ success: true, message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Invoice catalog and creation (complex business logic)
  app.get('/api/catalog/products', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the first firm the user has access to
      const userFirms = await storage.getFirmsByUserId(userId);
      if (userFirms.length === 0) {
        return res.status(403).json({ message: "No firm access found" });
      }

      const firm = userFirms[0];
      console.log('API credentials:', { 
        apiKey: firm.token ? 'exists' : 'missing', 
        baseUrl: firm.invoiceNinjaUrl + '/api/v1/' 
      });

      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const products = await invoiceNinja.getProducts();
      
      console.log('Response status: 200');
      console.log('Response data structure:', {
        hasData: products && products.length > 0,
        dataLength: products ? products.length : 0,
        hasMeta: !!products
      });
      console.log('Raw products from Invoice Ninja:', products ? products.length : 0);
      console.log('Transformed products:', products ? products.length : 0);
      
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Project reports and files management
  app.get('/api/projects/:projectId/reports', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const reports = await storage.getProjectReports(Number(projectId));
      res.json(reports);
    } catch (error) {
      console.error("Error fetching project reports:", error);
      res.status(500).json({ message: "Failed to fetch project reports" });
    }
  });

  app.post('/api/projects/:projectId/reports', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;
      
      const reportData = insertProjectReportSchema.parse({
        ...req.body,
        projectId: Number(projectId),
        createdBy: userId,
      });
      
      const report = await storage.createProjectReport(reportData);
      
      // Create history entry
      await storage.createProjectHistoryEntry({
        projectId: Number(projectId),
        userId,
        changeType: 'report_added',
        fieldName: null,
        oldValue: null,
        newValue: null,
        description: `Отчет добавлен (${reportData.rating}/5 звезд)`,
      });
      
      res.json(report);
    } catch (error) {
      console.error("Error creating project report:", error);
      res.status(500).json({ message: "Failed to create project report" });
    }
  });

  // Project notes management
  app.get('/api/projects/:projectId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      console.log('GET /api/projects/:projectId/notes - получение примечаний для проекта:', projectId);
      
      const notes = await storage.getProjectNotes(Number(projectId));
      console.log('Найдено примечаний:', notes.length);
      console.log('Примечания:', notes);
      
      res.json(notes);
    } catch (error) {
      console.error("Error fetching project notes:", error);
      res.status(500).json({ message: "Failed to fetch project notes" });
    }
  });

  app.post('/api/projects/:projectId/notes', isAuthenticated, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.userId;
      
      const noteData = insertProjectNoteSchema.parse({
        ...req.body,
        projectId: Number(projectId),
        userId,
      });
      
      const note = await storage.createProjectNote(noteData);
      res.json(note);
    } catch (error) {
      console.error("Error creating project note:", error);
      res.status(500).json({ message: "Failed to create project note" });
    }
  });

  // User management routes
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
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

  app.get('/api/users-with-firms', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const users = await storage.getUsers();
      
      // Get firms for each user
      const usersWithFirms = await Promise.all(
        users.map(async (user) => {
          const firms = await storage.getFirmsByUserId(user.id);
          return {
            ...user,
            firms: firms
          };
        })
      );
      
      res.json(usersWithFirms);
    } catch (error) {
      console.error("Error fetching users with firms:", error);
      res.status(500).json({ message: "Failed to fetch users with firms" });
    }
  });

  // Reports management routes
  app.patch('/api/reports/:id', isAuthenticated, async (req: any, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const updateData = z.object({
        rating: z.number().min(1).max(5).optional(),
        notes: z.string().optional(),
      }).parse(req.body);

      const report = await storage.updateReport(reportId, updateData);
      
      // Добавляем запись в историю проекта
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (userId && report && report.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: report.projectId,
          userId,
          changeType: 'report_updated',
          description: `Обновлен отчет (рейтинг: ${updateData.rating ? '★'.repeat(updateData.rating) : 'не указан'})`,
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
      const userId = req.user?.claims?.sub || req.session?.userId;
      if (userId && report && report.projectId) {
        await storage.createProjectHistoryEntry({
          projectId: report.projectId,
          userId,
          changeType: 'report_deleted',
          description: `Удален отчет`,
        });
      }
      
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error("Error deleting report:", error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Postmark email integration
  app.post('/api/postmark/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { firmId, testEmail } = z.object({
        firmId: z.string(),
        testEmail: z.string().email(),
      }).parse(req.body);

      const firm = await storage.getFirmById(firmId);
      
      if (!firm || !firm.postmarkServerToken) {
        return res.status(400).json({ message: "Firm not found or Postmark not configured" });
      }

      const postmarkService = new PostmarkService(
        firm.postmarkServerToken,
        firm.postmarkFromEmail || 'noreply@example.com',
        firm.postmarkMessageStream || 'main'
      );

      await postmarkService.sendTestEmail(testEmail);
      
      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email", error: error.message });
    }
  });

  // Home page statistics - MUST be before parameterized route
  app.get('/api/stats/home', isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's accessible firms
      const userFirms = await storage.getFirmsByUserId(userId);
      const firmIds = userFirms.map(firm => firm.id);

      let stats = {
        totalProjects: 0,
        activeProjects: 0,
        completedProjects: 0,
        totalClients: 0,
        totalCrews: 0,
        recentProjects: [] as any[]
      };

      if (firmIds.length > 0) {
        // Get statistics across all user's firms
        const allProjects = await Promise.all(
          firmIds.map(firmId => storage.getProjectsByFirmId(firmId))
        );
        const projects = allProjects.flat();

        const allClients = await Promise.all(
          firmIds.map(firmId => storage.getClientsByFirmId(firmId))
        );
        const clients = allClients.flat();

        const allCrews = await Promise.all(
          firmIds.map(firmId => storage.getCrewsByFirmId(firmId))
        );
        const crews = allCrews.flat();

        stats = {
          totalProjects: projects.length,
          activeProjects: projects.filter(p => !['completed', 'paid', 'cancelled'].includes(p.status)).length,
          completedProjects: projects.filter(p => ['completed', 'paid'].includes(p.status)).length,
          totalClients: clients.length,
          totalCrews: crews.length,
          recentProjects: projects
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        };
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching home stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Statistics routes
  app.get('/api/stats/:firmId', isAuthenticated, async (req: any, res) => {
    try {
      const { firmId } = req.params;
      const stats = await storage.getProjectStats(firmId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching firm stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Crew snapshots route (missing from modular refactor)
  app.get('/api/crew-snapshots/:id', isAuthenticated, async (req: any, res) => {
    try {
      const snapshotId = parseInt(req.params.id, 10);
      if (isNaN(snapshotId)) {
        return res.status(400).json({ message: "Invalid snapshot ID" });
      }

      const snapshot = await storage.getCrewSnapshotById(snapshotId);
      if (!snapshot) {
        return res.status(404).json({ message: "Crew snapshot not found" });
      }

      res.json(snapshot);
    } catch (error) {
      console.error("Error fetching crew snapshot:", error);
      res.status(500).json({ message: "Failed to fetch crew snapshot" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  return httpServer;
}