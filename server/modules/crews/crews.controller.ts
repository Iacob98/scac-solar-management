/**
 * Файл: server/modules/crews/crews.controller.ts
 * Назначение: Контроллер управления бригадами
 * Используется в: crews.routes.ts
 * Зависимости: storage
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Request, Response } from "express";
import { storage } from "../../storage";
import { insertCrewSchema, insertCrewMemberSchema } from "@shared/schema";

/**
 * Получить список бригад для фирмы
 * @param req HTTP запрос с firmId в query
 * @param res HTTP ответ
 */
export const getCrews = async (req: any, res: Response) => {
  try {
    const firmId = req.query.firmId as string;
    if (!firmId) {
      return res.status(400).json({ message: "Firm ID is required" });
    }
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const allCrews = await storage.getCrewsByFirmId(firmId);
    
    // Фильтрация по правам доступа
    let accessibleCrews: any[] = [];
    
    if (user.role === 'admin') {
      // Администраторы видят все бригады
      accessibleCrews = allCrews;
    } else {
      // Лейтеры видят все бригады своей фирмы
      const hasAccess = await storage.hasUserFirmAccess(userId, firmId);
      if (hasAccess) {
        accessibleCrews = allCrews;
      } else {
        accessibleCrews = [];
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
};

/**
 * Получить бригаду по ID
 * @param req HTTP запрос с ID бригады
 * @param res HTTP ответ
 */
export const getCrewById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Fetching crew with ID:', id);
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const crew = await storage.getCrewById(Number(id));
    console.log('Crew from database:', crew);
    
    if (!crew) {
      return res.status(404).json({ message: "Crew not found" });
    }
    
    // Проверка прав доступа
    let hasAccess = false;
    
    if (user.role === 'admin') {
      hasAccess = true;
    } else {
      // Проверяем доступ к фирме
      const firmAccess = await storage.hasUserFirmAccess(userId, crew.firmId);
      hasAccess = firmAccess;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(crew);
  } catch (error) {
    console.error("Error fetching crew:", error);
    res.status(500).json({ message: "Failed to fetch crew" });
  }
};

/**
 * Создать новую бригаду
 * @param req HTTP запрос с данными бригады
 * @param res HTTP ответ
 */
export const createCrew = async (req: any, res: Response) => {
  try {
    console.log('🚀 POST /api/crews - Request received');
    console.log('📋 Request body:', req.body);
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    console.log('👤 User:', userId);
    
    const { members, ...crewData } = req.body;
    console.log('🔧 Separated crew data:', crewData);
    console.log('👥 Members:', members);
    
    // Валидация данных бригады
    const validatedCrewData = insertCrewSchema.parse(crewData);
    console.log('✅ Crew data validated:', validatedCrewData);
    
    // Создание бригады
    const crew = await storage.createCrew(validatedCrewData);
    console.log('🎯 Crew created:', crew);
    
    // Создание участников бригады если они есть
    if (members && Array.isArray(members) && members.length > 0) {
      console.log(`👥 Creating ${members.length} crew members...`);
      
      for (const memberData of members) {
        const validatedMemberData = insertCrewMemberSchema.parse({
          ...memberData,
          crewId: crew.id,
        });
        
        await storage.createCrewMember(validatedMemberData);
        console.log('👤 Member created:', validatedMemberData.firstName, validatedMemberData.lastName);
      }
    }
    
    console.log('🎉 Crew creation successful, sending response');
    res.json(crew);
  } catch (error) {
    console.error("Error creating crew:", error);
    res.status(500).json({ message: "Failed to create crew" });
  }
};

/**
 * Обновить бригаду
 * @param req HTTP запрос с обновляемыми данными
 * @param res HTTP ответ
 */
export const updateCrew = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub || req.session?.userId;
    
    // Проверяем права доступа
    const existingCrew = await storage.getCrewById(Number(id));
    if (!existingCrew) {
      return res.status(404).json({ message: "Crew not found" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Проверяем доступ к фирме
    const hasAccess = user.role === 'admin' || 
      await storage.hasUserFirmAccess(userId, existingCrew.firmId);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const updatedCrew = await storage.updateCrew(Number(id), req.body);
    res.json(updatedCrew);
  } catch (error) {
    console.error("Error updating crew:", error);
    res.status(500).json({ message: "Failed to update crew" });
  }
};

/**
 * Удалить бригаду
 * @param req HTTP запрос с ID бригады
 * @param res HTTP ответ
 */
export const deleteCrew = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub || req.session?.userId;
    
    // Проверяем права доступа
    const crew = await storage.getCrewById(Number(id));
    if (!crew) {
      return res.status(404).json({ message: "Crew not found" });
    }
    
    const user = await storage.getUser(userId);
    const hasAccess = user?.role === 'admin' || 
      await storage.hasUserFirmAccess(userId, crew.firmId);
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteCrew(Number(id));
    res.json({ success: true, message: "Crew deleted successfully" });
  } catch (error) {
    console.error("Error deleting crew:", error);
    res.status(500).json({ message: "Failed to delete crew" });
  }
};

/**
 * Получить сводную статистику по всем бригадам
 * @param req HTTP запрос с параметрами from, to, firmId
 * @param res HTTP ответ
 */
export const getCrewsStatsSummary = async (req: any, res: Response) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const firmId = req.query.firmId as string;
    
    if (!from || !to || !firmId) {
      return res.status(400).json({ message: "Date range (from/to) and firmId are required" });
    }
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Получаем все бригады для фирмы
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
          avgCompletionTime: stats.metrics.avgDurationDays
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
            avgCompletionTime: stats.metrics.avgDurationDays
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
};

/**
 * Получить детальную статистику по бригаде
 * @param req HTTP запрос с ID бригады и параметрами from, to
 * @param res HTTP ответ
 */
export const getCrewStats = async (req: any, res: Response) => {
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
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const crew = await storage.getCrewById(crewId);
    if (!crew) {
      return res.status(404).json({ message: "Crew not found" });
    }
    
    // Проверяем права доступа
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
        return res.status(403).json({ message: "Access denied to this crew's statistics" });
      }
    }
    
    const statistics = await storage.getCrewStatistics(crewId, from, to);
    
    res.json({
      crewId,
      crewName: crew.name,
      period: { from, to },
      ...statistics
    });
  } catch (error) {
    console.error("Error fetching crew statistics:", error);
    res.status(500).json({ message: "Failed to fetch crew statistics" });
  }
};