/**
 * Файл: server/modules/firms/firms.controller.ts
 * Назначение: Контроллер управления фирмами
 * Используется в: firms.routes.ts
 * Зависимости: storage, InvoiceNinjaService
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Request, Response } from "express";
import { storage } from "../../storage";
import { InvoiceNinjaService } from "../../services/invoiceNinja";
import { insertFirmSchema } from "@shared/schema";

/**
 * Получить список фирм пользователя
 * @param req HTTP запрос с данными пользователя
 * @param res HTTP ответ
 */
export const getUserFirms = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
    const firms = await storage.getFirmsByUserId(userId);
    res.json(firms);
  } catch (error) {
    console.error("Error fetching firms:", error);
    res.status(500).json({ message: "Failed to fetch firms" });
  }
};

/**
 * Получить фирму по ID
 * @param req HTTP запрос с ID фирмы
 * @param res HTTP ответ
 */
export const getFirmById = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    const firmId = req.params.id;
    
    const firm = await storage.getFirmById(firmId);
    
    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }
    
    // Проверяем доступ пользователя к фирме
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
};

/**
 * Создать новую фирму (только для администраторов)
 * @param req HTTP запрос с данными фирмы
 * @param res HTTP ответ
 */
export const createFirm = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
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
};

/**
 * Обновить данные фирмы (только для администраторов)
 * @param req HTTP запрос с обновляемыми данными
 * @param res HTTP ответ
 */
export const updateFirm = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
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
      postmarkServerToken: req.body.postmarkServerToken,
      postmarkFromEmail: req.body.postmarkFromEmail,
      postmarkMessageStream: req.body.postmarkMessageStream,
      emailSubjectTemplate: req.body.emailSubjectTemplate,
      emailBodyTemplate: req.body.emailBodyTemplate,
    };
    
    const updatedFirm = await storage.updateFirm(firmId, updateData);
    res.json(updatedFirm);
  } catch (error) {
    console.error('Error updating firm:', error);
    res.status(500).json({ message: 'Failed to update firm' });
  }
};

/**
 * Протестировать соединение с Invoice Ninja
 * @param req HTTP запрос с URL и токеном
 * @param res HTTP ответ
 */
export const testInvoiceNinjaConnection = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
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
};