import express from "express";
import { storage } from "../storage";
import { createReclamationSchema } from "@shared/schema";
import { z } from "zod";

const router = express.Router();

// POST /api/projects/:projectId/reclamation - Создать рекламацию
// ВАЖНО: Этот роут должен быть ПЕРВЫМ, чтобы не конфликтовать с /:id
router.post("/:projectId/reclamation", async (req, res) => {
  console.log("POST /:projectId/reclamation called with projectId:", req.params.projectId);
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
router.get("/:projectId/reclamations", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const reclamations = await storage.getReclamationsByProjectId(projectId);
    res.json(reclamations);
  } catch (error) {
    console.error("Error getting project reclamations:", error);
    res.status(500).json({ error: "Failed to get project reclamations" });
  }
});

// GET /api/reclamations - Список рекламаций фирмы
router.get("/", async (req, res) => {
  try {
    const user = req.user!;
    const firmId = parseInt(req.query.firmId as string);

    if (!firmId) {
      return res.status(400).json({ error: "firmId is required" });
    }

    // Проверка доступа к фирме
    const hasAccess = await storage.hasUserFirmAccess(user.id, firmId.toString());
    if (!hasAccess && user.role !== 'admin') {
      return res.status(403).json({ error: "Access denied to this firm" });
    }

    const reclamations = await storage.getReclamationsByFirmId(firmId);
    res.json(reclamations);
  } catch (error) {
    console.error("Error getting reclamations:", error);
    res.status(500).json({ error: "Failed to get reclamations" });
  }
});

// GET /api/reclamations/:id/history - История рекламации
// ВАЖНО: Должен быть перед /:id чтобы не конфликтовать
router.get("/:id/history", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const history = await storage.getReclamationHistory(id);
    res.json(history);
  } catch (error) {
    console.error("Error getting reclamation history:", error);
    res.status(500).json({ error: "Failed to get reclamation history" });
  }
});

// GET /api/reclamations/:id - Получить рекламацию по ID
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reclamation = await storage.getReclamationById(id);

    if (!reclamation) {
      return res.status(404).json({ error: "Reclamation not found" });
    }

    res.json(reclamation);
  } catch (error) {
    console.error("Error getting reclamation:", error);
    res.status(500).json({ error: "Failed to get reclamation" });
  }
});

// PATCH /api/reclamations/:id - Обновить рекламацию (переназначить бригаду)
router.patch("/:id", async (req, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);

    // Проверка роли
    if (user.role !== 'admin' && user.role !== 'leiter') {
      return res.status(403).json({ error: "Only admin and leiter can update reclamations" });
    }

    const reclamation = await storage.getReclamationById(id);
    if (!reclamation) {
      return res.status(404).json({ error: "Reclamation not found" });
    }

    const { crewId, deadline, description } = req.body;

    const updates: any = {};

    if (crewId) {
      // Проверяем новую бригаду
      const crew = await storage.getCrewById(crewId);
      if (!crew) {
        return res.status(404).json({ error: "Crew not found" });
      }
      updates.currentCrewId = crewId;
      updates.status = 'pending'; // Сбрасываем статус для новой бригады

      // Добавляем запись в историю
      await storage.addReclamationHistoryEntry({
        reclamationId: id,
        action: 'reassigned',
        actionBy: user.id,
        crewId: crewId,
        notes: `Переназначено с бригады ${reclamation.currentCrewId} на бригаду ${crewId}`,
      });
    }

    if (deadline) {
      updates.deadline = deadline;
    }

    if (description) {
      updates.description = description;
    }

    const updated = await storage.updateReclamation(id, updates);
    res.json(updated);
  } catch (error) {
    console.error("Error updating reclamation:", error);
    res.status(500).json({ error: "Failed to update reclamation" });
  }
});

// DELETE /api/reclamations/:id - Отменить рекламацию
router.delete("/:id", async (req, res) => {
  try {
    const user = req.user!;
    const id = parseInt(req.params.id);

    // Проверка роли
    if (user.role !== 'admin' && user.role !== 'leiter') {
      return res.status(403).json({ error: "Only admin and leiter can cancel reclamations" });
    }

    const reclamation = await storage.getReclamationById(id);
    if (!reclamation) {
      return res.status(404).json({ error: "Reclamation not found" });
    }

    // Отменяем рекламацию
    const cancelled = await storage.cancelReclamation(id);

    // Возвращаем статус проекта к work_completed
    await storage.updateProjectStatus(reclamation.projectId, 'work_completed');

    // Добавляем в историю
    await storage.createProjectHistoryEntry({
      projectId: reclamation.projectId,
      userId: user.id,
      changeType: 'status_change',
      fieldName: 'status',
      oldValue: 'reclamation',
      newValue: 'work_completed',
      description: 'Рекламация отменена',
    });

    res.json(cancelled);
  } catch (error) {
    console.error("Error cancelling reclamation:", error);
    res.status(500).json({ error: "Failed to cancel reclamation" });
  }
});

export default router;
