import { Router, Response } from "express";
import { db } from "../db";
import { craftosSyncConfig, craftosAppointments } from "@shared/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { craftosSyncService } from "../services/craftosSync";
import { insertCraftosSyncConfigSchema } from "@shared/schema";

const router = Router();

// GET /api/craftos/config/:firmId - get sync config for a firm
router.get("/config/:firmId", async (req: any, res: Response) => {
  try {
    const firmId = parseInt(req.params.firmId);
    const [config] = await db
      .select({
        id: craftosSyncConfig.id,
        firmId: craftosSyncConfig.firmId,
        email: craftosSyncConfig.email,
        enabled: craftosSyncConfig.enabled,
        syncIntervalMinutes: craftosSyncConfig.syncIntervalMinutes,
        lastSyncAt: craftosSyncConfig.lastSyncAt,
        lastSyncStatus: craftosSyncConfig.lastSyncStatus,
        lastSyncError: craftosSyncConfig.lastSyncError,
        createdAt: craftosSyncConfig.createdAt,
      })
      .from(craftosSyncConfig)
      .where(eq(craftosSyncConfig.firmId, firmId));

    res.json(config || null);
  } catch (error) {
    console.error("Error fetching craftos config:", error);
    res.status(500).json({ message: "Ошибка получения конфигурации CraftOS" });
  }
});

// POST /api/craftos/config - create or update sync config
router.post("/config", async (req: any, res: Response) => {
  try {
    const { firmId, email, password, enabled, syncIntervalMinutes } = req.body;

    // Check if config exists
    const [existing] = await db
      .select()
      .from(craftosSyncConfig)
      .where(eq(craftosSyncConfig.firmId, firmId));

    if (!firmId || !email) {
      return res.status(400).json({ message: "firmId and email are required" });
    }

    // Password required for new config, optional for update
    if (!existing && !password) {
      return res.status(400).json({ message: "password is required for new configuration" });
    }

    if (existing) {
      const updateData: Record<string, any> = {
        email,
        enabled: enabled ?? true,
        syncIntervalMinutes: syncIntervalMinutes ?? 60,
        updatedAt: new Date(),
      };
      // Only update password if provided
      if (password) {
        updateData.password = password;
      }

      const [updated] = await db
        .update(craftosSyncConfig)
        .set(updateData)
        .where(eq(craftosSyncConfig.id, existing.id))
        .returning();

      // Restart sync timer
      if (updated.enabled) {
        craftosSyncService.scheduleSyncForFirm(updated);
      } else {
        craftosSyncService.stopSyncForFirm(updated.firmId);
      }

      return res.json({ message: "Конфигурация обновлена", config: { ...updated, password: "***" } });
    }

    const [config] = await db
      .insert(craftosSyncConfig)
      .values({
        firmId,
        email,
        password,
        enabled: enabled ?? true,
        syncIntervalMinutes: syncIntervalMinutes ?? 60,
      })
      .returning();

    // Start sync timer
    if (config.enabled) {
      craftosSyncService.scheduleSyncForFirm(config);
    }

    res.json({ message: "Конфигурация создана", config: { ...config, password: "***" } });
  } catch (error) {
    console.error("Error saving craftos config:", error);
    res.status(500).json({ message: "Ошибка сохранения конфигурации CraftOS" });
  }
});

// POST /api/craftos/test-auth - test CraftOS authentication
router.post("/test-auth", async (req: any, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const tokens = await craftosSyncService.authenticate(email, password);

    // Also try to fetch teams as a health check
    const teams = await craftosSyncService.fetchTeams(tokens.access_token);

    res.json({
      success: true,
      message: `Аутентификация успешна. Найдено ${teams.length} бригад в CraftOS.`,
      teamsCount: teams.length,
      teamNames: teams.map((t) => t.name),
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: `Ошибка аутентификации: ${error.message}`,
    });
  }
});

// POST /api/craftos/sync/:firmId - trigger manual sync
router.post("/sync/:firmId", async (req: any, res: Response) => {
  try {
    const firmId = parseInt(req.params.firmId);
    const weekFrom = req.body.weekFrom ? parseInt(req.body.weekFrom) : undefined;
    const weekTo = req.body.weekTo ? parseInt(req.body.weekTo) : undefined;

    console.log(`[CraftOS] Manual sync triggered for firm ${firmId}, weeks ${weekFrom || 'auto'}-${weekTo || 'auto'}`);
    const result = await craftosSyncService.syncForFirm(firmId, { weekFrom, weekTo });

    res.json({
      message: "Синхронизация завершена",
      ...result,
    });
  } catch (error: any) {
    console.error("Error during craftos sync:", error);
    res.status(500).json({ message: `Ошибка синхронизации: ${error.message}` });
  }
});

// GET /api/craftos/appointments/:firmId - get all synced appointments
router.get("/appointments/:firmId", async (req: any, res: Response) => {
  try {
    const firmId = parseInt(req.params.firmId);
    const onlyUnlinked = req.query.unlinked === "true";

    let query = db
      .select()
      .from(craftosAppointments)
      .where(
        onlyUnlinked
          ? and(eq(craftosAppointments.firmId, firmId), isNull(craftosAppointments.projectId))
          : eq(craftosAppointments.firmId, firmId)
      )
      .orderBy(desc(craftosAppointments.appointmentDate));

    const appointments = await query;
    res.json(appointments);
  } catch (error) {
    console.error("Error fetching craftos appointments:", error);
    res.status(500).json({ message: "Ошибка получения назначений CraftOS" });
  }
});

// POST /api/craftos/create-project/:appointmentId - create project from appointment
router.post("/create-project/:appointmentId", async (req: any, res: Response) => {
  try {
    const appointmentId = parseInt(req.params.appointmentId);
    const userId = req.user.id;
    const firmId = parseInt(req.body.firmId);

    if (!firmId) {
      return res.status(400).json({ message: "firmId is required" });
    }

    const result = await craftosSyncService.createProjectFromAppointment(
      appointmentId,
      userId,
      firmId
    );

    if ("error" in result) {
      return res.status(400).json({ message: result.error });
    }

    res.json({ message: "Проект создан", projectId: result.projectId });
  } catch (error: any) {
    console.error("Error creating project from appointment:", error);
    res.status(500).json({ message: `Ошибка создания проекта: ${error.message}` });
  }
});

// POST /api/craftos/bulk-create/:firmId - bulk create projects from all unlinked
router.post("/bulk-create/:firmId", async (req: any, res: Response) => {
  try {
    const firmId = parseInt(req.params.firmId);
    const userId = req.user.id;

    const result = await craftosSyncService.bulkCreateProjects(firmId, userId);

    res.json({
      message: `Создано ${result.created} проектов`,
      ...result,
    });
  } catch (error: any) {
    console.error("Error bulk creating projects:", error);
    res.status(500).json({ message: `Ошибка массового создания: ${error.message}` });
  }
});

// DELETE /api/craftos/config/:firmId - disable and remove sync config
router.delete("/config/:firmId", async (req: any, res: Response) => {
  try {
    const firmId = parseInt(req.params.firmId);

    craftosSyncService.stopSyncForFirm(firmId);

    await db
      .delete(craftosSyncConfig)
      .where(eq(craftosSyncConfig.firmId, firmId));

    res.json({ message: "Конфигурация CraftOS удалена" });
  } catch (error) {
    console.error("Error deleting craftos config:", error);
    res.status(500).json({ message: "Ошибка удаления конфигурации" });
  }
});

export default router;
