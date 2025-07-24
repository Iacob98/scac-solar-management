/**
 * Файл: server/modules/clients/clients.controller.ts
 * Назначение: Контроллер управления клиентами
 * Используется в: clients.routes.ts
 * Зависимости: storage, InvoiceNinjaService
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Request, Response } from "express";
import { storage } from "../../storage";
import { InvoiceNinjaService } from "../../services/invoiceNinja";
import { insertClientSchema } from "@shared/schema";

/**
 * Получить список клиентов фирмы с синхронизацией из Invoice Ninja
 * @param req HTTP запрос с firmId в query
 * @param res HTTP ответ
 */
export const getClients = async (req: any, res: Response) => {
  try {
    const firmId = req.query.firmId as string;
    if (!firmId) {
      return res.status(400).json({ message: "Firm ID is required" });
    }
    
    // Получаем данные фирмы для доступа к Invoice Ninja
    const firm = await storage.getFirmById(firmId);
    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    try {
      // Синхронизируем клиентов с Invoice Ninja
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      const ninjaClients = await invoiceNinja.getClients();
      
      // Обновляем локальную базу данных
      for (const ninjaClient of ninjaClients) {
        const existingClient = await storage.getClientByNinjaId(firmId, ninjaClient.id);
        if (!existingClient) {
          await storage.createClient({
            firmId,
            ninjaClientId: ninjaClient.id,
            name: ninjaClient.name,
            email: ninjaClient.email || null,
            phone: ninjaClient.phone || null,
            address: ninjaClient.address1 ? 
              `${ninjaClient.address1}, ${ninjaClient.city || ''}, ${ninjaClient.postal_code || ''}`.trim() : 
              null,
          });
        }
      }
    } catch (ninjaError) {
      console.warn("Warning: Could not sync with Invoice Ninja, using local clients only:", ninjaError);
    }
    
    // Возвращаем всех локальных клиентов для этой фирмы
    const clients = await storage.getClientsByFirmId(firmId);
    res.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    res.status(500).json({ message: "Failed to fetch clients" });
  }
};

/**
 * Получить клиента по ID
 * @param req HTTP запрос с ID клиента
 * @param res HTTP ответ
 */
export const getClientById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Fetching client with ID:', id);
    
    const client = await storage.getClientById(Number(id));
    console.log('Client from database:', client);
    
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    res.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    res.status(500).json({ message: "Failed to fetch client" });
  }
};

/**
 * Обновить данные клиента
 * @param req HTTP запрос с обновляемыми данными
 * @param res HTTP ответ
 */
export const updateClient = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
    };
    
    const updatedClient = await storage.updateClient(Number(id), updateData);
    
    if (!updatedClient) {
      return res.status(404).json({ message: "Client not found" });
    }
    
    res.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    res.status(500).json({ message: "Failed to update client" });
  }
};

/**
 * Создать нового клиента с синхронизацией в Invoice Ninja
 * @param req HTTP запрос с данными клиента
 * @param res HTTP ответ
 */
export const createClient = async (req: any, res: Response) => {
  try {
    const clientData = insertClientSchema.parse(req.body);
    
    // Получаем данные фирмы для интеграции с Invoice Ninja
    const firm = await storage.getFirmById(clientData.firmId);
    if (!firm) {
      return res.status(404).json({ message: 'Firm not found' });
    }

    try {
      // Создаем клиента в Invoice Ninja
      const invoiceNinja = new InvoiceNinjaService(firm.token, firm.invoiceNinjaUrl);
      
      const ninjaClientData = {
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        address1: clientData.address,
      };

      const ninjaClient = await invoiceNinja.createClient(ninjaClientData);
      
      // Создаем клиента в локальной базе данных с ID из Invoice Ninja
      const client = await storage.createClient({
        ...clientData,
        ninjaClientId: ninjaClient.id,
      });
      
      res.json(client);
    } catch (ninjaError) {
      console.warn("Warning: Could not create client in Invoice Ninja, creating locally only:", ninjaError);
      // Fallback: создаем только в локальной базе данных
      const client = await storage.createClient(clientData);
      res.json(client);
    }
  } catch (error) {
    console.error("Error creating client:", error);
    res.status(500).json({ message: "Failed to create client" });
  }
};