/**
 * Файл: server/modules/projects/projects.controller.ts
 * Назначение: Контроллер управления проектами
 * Используется в: projects.routes.ts
 * Зависимости: storage, services/invoiceNinja
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import type { Request, Response } from "express";
import { storage } from "../../storage";
import { insertProjectSchema } from "@shared/schema";

/**
 * Получить список проектов для фирмы
 * @param req HTTP запрос с firmId в query
 * @param res HTTP ответ
 */
export const getProjects = async (req: any, res: Response) => {
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

    let projects;
    if (user.role === 'admin') {
      // Администратор видит все проекты фирмы
      projects = await storage.getProjectsByFirmId(firmId);
    } else {
      // Обычный пользователь видит только свои проекты и расшаренные
      projects = await storage.getProjectsByFirmId(firmId);
      projects = projects.filter(project => {
        return project.leiterId === userId;
        // TODO: добавить фильтрацию по shared projects
      });
    }

    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ message: "Failed to fetch projects" });
  }
};

/**
 * Получить проект по ID
 * @param req HTTP запрос с ID проекта
 * @param res HTTP ответ
 */
export const getProjectById = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Fetching project with ID:', id);
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const project = await storage.getProjectById(Number(id));
    console.log('Project from database:', project);
    
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    // Проверка прав доступа
    if (user.role !== 'admin' && project.leiterId !== userId) {
      // TODO: проверить shared projects
      return res.status(403).json({ message: "Access denied" });
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ message: "Failed to fetch project" });
  }
};

/**
 * Создать новый проект
 * @param req HTTP запрос с данными проекта
 * @param res HTTP ответ
 */
export const createProject = async (req: any, res: Response) => {
  try {
    const userId = req.user?.claims?.sub || req.session?.userId;
    const projectData = insertProjectSchema.parse({
      ...req.body,
      leiterId: userId,
    });
    
    const project = await storage.createProject(projectData);
    
    // Создание записи в истории
    await storage.createProjectHistoryEntry({
      projectId: project.id,
      userId,
      changeType: 'project_created',
      fieldName: null,
      oldValue: null,
      newValue: null,
      description: 'Проект создан',
    });
    
    res.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ message: "Failed to create project" });
  }
};

/**
 * Обновить проект
 * @param req HTTP запрос с обновляемыми данными
 * @param res HTTP ответ
 */
export const updateProject = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub || req.session?.userId;
    
    // Проверяем существование проекта и права доступа
    const existingProject = await storage.getProjectById(Number(id));
    if (!existingProject) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    if (user.role !== 'admin' && existingProject.leiterId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const updatedProject = await storage.updateProject(Number(id), req.body);
    
    // Создание записи в истории об обновлении
    await storage.createProjectHistoryEntry({
      projectId: Number(id),
      userId,
      changeType: 'info_update',
      fieldName: 'general',
      oldValue: null,
      newValue: null,
      description: 'Проект обновлен',
    });
    
    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ message: "Failed to update project" });
  }
};

/**
 * Удалить проект
 * @param req HTTP запрос с ID проекта
 * @param res HTTP ответ
 */
export const deleteProject = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub || req.session?.userId;
    
    // Проверяем права доступа
    const project = await storage.getProjectById(Number(id));
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    const user = await storage.getUser(userId);
    if (!user || (user.role !== 'admin' && project.leiterId !== userId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteProject(Number(id));
    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ message: "Failed to delete project" });
  }
};

/**
 * Получить историю изменений проекта
 * @param req HTTP запрос с ID проекта
 * @param res HTTP ответ
 */
export const getProjectHistory = async (req: any, res: Response) => {
  try {
    const projectId = parseInt(req.params.id);
    
    if (isNaN(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }
    
    const userId = req.user?.claims?.sub || req.session?.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Проверяем доступ к проекту
    const project = await storage.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    
    // Проверка прав доступа
    let hasAccess = false;
    
    if (user.role === 'admin') {
      hasAccess = true;
    } else if (project.leiterId === userId) {
      hasAccess = true;
    } else {
      // Проверяем, расшарен ли проект с пользователем
      const shares = await storage.getProjectShares(projectId);
      hasAccess = shares.some(share => share.sharedWith === userId);
    }
    
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied to this project" });
    }
    
    const history = await storage.getProjectHistory(projectId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching project history:", error);
    res.status(500).json({ message: "Failed to fetch project history" });
  }
};