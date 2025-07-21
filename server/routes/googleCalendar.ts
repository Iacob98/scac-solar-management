import { Router } from 'express';
import { db } from '../db';
import { firms, crews, projects, clients, crewMembers, googleTokens, calendarLogs, googleCalendarSettings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { googleCalendarService, type CalendarEvent } from '../services/googleCalendar';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

/**
 * Сохранить настройки Google Calendar API
 */
router.post('/settings', requireAuth, async (req, res) => {
  try {
    const data = apiSettingsSchema.parse(req.body);
    
    // Проверяем права доступа
    const user = req.user! as any as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    // Проверяем что фирма существует
    const [firm] = await db.select().from(firms).where(eq(firms.id, data.firmId));
    if (!firm) {
      return res.status(404).json({ message: 'Фирма не найдена' });
    }

    // Сохраняем настройки в базу (пока используем таблицу google_calendar_settings)
    await db
      .insert(googleCalendarSettings)
      .values({
        firmId: data.firmId,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUri: data.redirectUri,
        masterCalendarId: data.masterCalendarId || null,
      })
      .onConflictDoUpdate({
        target: googleCalendarSettings.firmId,
        set: {
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          redirectUri: data.redirectUri,
          masterCalendarId: data.masterCalendarId || null,
          updatedAt: new Date(),
        },
      });

    // Настройки сохранены, Google Calendar Service будет загружать их из базы при необходимости

    res.json({ success: true, message: 'Настройки сохранены успешно' });
  } catch (error) {
    console.error('Error saving API settings:', error);
    res.status(500).json({ message: 'Ошибка сохранения настроек' });
  }
});

/**
 * Получить настройки Google Calendar API для фирмы
 */
router.get('/settings/:firmId', requireAuth, async (req, res) => {
  try {
    const { firmId } = connectGoogleSchema.parse(req.params);
    
    // Проверяем права доступа
    const user = req.user! as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const [settings] = await db
      .select()
      .from(googleCalendarSettings)
      .where(eq(googleCalendarSettings.firmId, firmId));

    if (!settings) {
      return res.json({ configured: false });
    }

    // Возвращаем настройки без секретных данных
    res.json({
      configured: true,
      clientId: settings.clientId,
      redirectUri: settings.redirectUri,
      masterCalendarId: settings.masterCalendarId,
    });
  } catch (error) {
    console.error('Error getting API settings:', error);
    res.status(500).json({ message: 'Ошибка получения настроек' });
  }
});

// Схемы валидации
const connectGoogleSchema = z.object({
  firmId: z.string().uuid()
});

const createMasterCalendarSchema = z.object({
  firmId: z.string().uuid()
});

const createCrewCalendarSchema = z.object({
  crewId: z.number().int().positive()
});

const syncProjectSchema = z.object({
  projectId: z.number().int().positive()
});

const updateCrewMembersSchema = z.object({
  crewId: z.number().int().positive(),
  members: z.array(z.object({
    id: z.number().int().positive().optional(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    memberEmail: z.string().email().optional(),
    role: z.string().default('worker'),
    address: z.string().optional(),
    uniqueNumber: z.string().min(1),
    phone: z.string().optional()
  }))
});

const apiSettingsSchema = z.object({
  firmId: z.string().uuid(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  masterCalendarId: z.string().optional()
});

/**
 * Получить URL для подключения Google Calendar
 */
router.get('/connect/:firmId', requireAuth, async (req, res) => {
  try {
    const { firmId } = connectGoogleSchema.parse(req.params);
    
    // Проверяем права доступа
    const user = req.user! as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    const authUrl = await googleCalendarService.getAuthUrl(firmId);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: 'Ошибка создания ссылки авторизации' });
  }
});

/**
 * Обработка callback от Google OAuth
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state: firmId } = req.query;
    
    if (!code || !firmId) {
      return res.status(400).json({ message: 'Отсутствует код авторизации или ID фирмы' });
    }

    await googleCalendarService.exchangeCodeForTokens(code as string, firmId as string);
    
    // Получаем информацию о фирме для создания календаря  
    const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
    if (firm && !firm.gcalMasterId) {
      try {
        // Автоматически создаем корпоративный календарь после успешной авторизации
        const calendarId = await googleCalendarService.createCalendar(
          `Проекты – ${firm.name}`,
          `Корпоративный календарь проектов для ${firm.name}`,
          firmId
        );
        
        // Обновляем фирму с ID корпоративного календаря
        await db
          .update(firms)
          .set({ gcalMasterId: calendarId })
          .where(eq(firms.id, firmId));
          
      } catch (error) {
        console.error('Error creating master calendar after OAuth:', error);
        // Не прерываем процесс, просто логируем ошибку
      }
    }
    
    // Перенаправляем обратно в приложение с сообщением об успехе
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5000'}/?google_auth=success`);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5000'}/?google_auth=error`);
  }
});

/**
 * Создать корпоративный календарь фирмы
 */
router.post('/firm/create-master-calendar', requireAuth, async (req, res) => {
  try {
    const { firmId } = createMasterCalendarSchema.parse(req.body);
    const user = req.user! as any;
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Доступ запрещен' });
    }

    // Получаем информацию о фирме
    const [firm] = await db.select().from(firms).where(eq(firms.id, firmId)).limit(1);
    if (!firm) {
      return res.status(404).json({ message: 'Фирма не найдена' });
    }

    if (firm.gcalMasterId) {
      return res.status(400).json({ message: 'У фирмы уже есть корпоративный календарь' });
    }

    // Устанавливаем учетные данные фирмы
    await googleCalendarService.setFirmCredentials(firmId);
    
    // Создаем календарь
    const calendarId = await googleCalendarService.createCalendar(
      `Проекты – ${firm.name}`,
      `Корпоративный календарь проектов для ${firm.name}`
    );

    // Обновляем запись фирмы
    await db.update(firms)
      .set({ gcalMasterId: calendarId })
      .where(eq(firms.id, firmId));

    // Логируем операцию
    await googleCalendarService.logOperation({
      userId: user.id,
      action: 'create_master_calendar',
      projectId: null,
      eventId: null,
      status: 'success',
      details: { firmId, calendarId, calendarName: `Проекты – ${firm.name}` }
    });

    res.json({ 
      message: 'Корпоративный календарь создан', 
      calendarId,
      viewUrl: googleCalendarService.getCalendarViewUrl(calendarId)
    });
  } catch (error) {
    console.error('Error creating master calendar:', error);
    
    // Логируем ошибку
    if (req.user) {
      await googleCalendarService.logOperation({
        userId: req.user.id,
        action: 'create_master_calendar',
        projectId: null,
        eventId: null,
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
    
    res.status(500).json({ message: 'Ошибка создания календаря' });
  }
});

/**
 * Создать календарь для бригады
 */
router.post('/crew/create-calendar', requireAuth, async (req, res) => {
  try {
    const { crewId } = createCrewCalendarSchema.parse(req.body);
    const user = req.user! as any;

    // Получаем информацию о бригаде
    const [crew] = await db.select()
      .from(crews)
      .where(eq(crews.id, crewId))
      .limit(1);
    
    if (!crew) {
      return res.status(404).json({ message: 'Бригада не найдена' });
    }

    if (crew.gcalId) {
      return res.status(400).json({ message: 'У бригады уже есть календарь' });
    }

    // Проверяем права доступа (админ или leiter этой фирмы)
    if (user.role !== 'admin') {
      // Дополнительная проверка для leiter - они могут управлять только бригадами своих фирм
      const [firmAccess] = await db.select()
        .from(firms)
        .where(eq(firms.id, crew.firmId))
        .limit(1);
      
      if (!firmAccess) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    // Устанавливаем учетные данные фирмы
    await googleCalendarService.setFirmCredentials(crew.firmId);
    
    // Создаем календарь
    const calendarId = await googleCalendarService.createCalendar(
      `Бригада ${crew.uniqueNumber}`,
      `Календарь бригады ${crew.name} (${crew.uniqueNumber})`
    );

    // Обновляем запись бригады
    await db.update(crews)
      .set({ gcalId: calendarId })
      .where(eq(crews.id, crewId));

    // Добавляем участников бригады в ACL календаря
    const members = await db.select()
      .from(crewMembers)
      .where(eq(crewMembers.crewId, crewId));

    for (const member of members) {
      if (member.memberEmail) {
        try {
          await googleCalendarService.addCalendarUser(calendarId, member.memberEmail, 'reader');
        } catch (error) {
          console.error(`Error adding member ${member.memberEmail} to calendar:`, error);
          // Не прерываем процесс, просто логируем ошибку
        }
      }
    }

    // Логируем операцию
    await googleCalendarService.logOperation({
      userId: user.id,
      action: 'create_crew_calendar',
      projectId: null,
      eventId: null,
      status: 'success',
      details: { crewId, calendarId, calendarName: `Бригада ${crew.uniqueNumber}` }
    });

    res.json({ 
      message: 'Календарь бригады создан', 
      calendarId,
      viewUrl: googleCalendarService.getCalendarViewUrl(calendarId)
    });
  } catch (error) {
    console.error('Error creating crew calendar:', error);
    
    // Логируем ошибку
    if (req.user) {
      await googleCalendarService.logOperation({
        userId: req.user.id,
        action: 'create_crew_calendar',
        projectId: null,
        eventId: null,
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
    
    res.status(500).json({ message: 'Ошибка создания календаря бригады' });
  }
});

/**
 * Синхронизировать проект с календарем
 */
router.post('/sync-project', requireAuth, async (req, res) => {
  try {
    const { projectId } = syncProjectSchema.parse(req.body);
    const user = req.user! as any;

    // Получаем полную информацию о проекте
    const [project] = await db.select()
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .leftJoin(crews, eq(projects.crewId, crews.id))
      .leftJoin(firms, eq(projects.firmId, firms.id))
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return res.status(404).json({ message: 'Проект не найден' });
    }

    const projectData = project.projects;
    const client = project.clients;
    const crew = project.crews;
    const firm = project.firms;

    if (!crew || !crew.gcalId) {
      return res.status(400).json({ message: 'У бригады нет календаря' });
    }

    if (!firm || !firm.gcalMasterId) {
      return res.status(400).json({ message: 'У фирмы нет корпоративного календаря' });
    }

    if (!projectData.workStartDate || !projectData.workEndDate) {
      return res.status(400).json({ message: 'У проекта не указаны даты работ' });
    }

    // Устанавливаем учетные данные фирмы
    await googleCalendarService.setFirmCredentials(projectData.firmId);

    // Формируем данные события
    const eventData: CalendarEvent = {
      summary: `Монтаж: ${client?.name || 'Клиент не указан'}`,
      location: client?.address || '',
      description: `Проект #${projectData.id}\nБригада: ${crew.name}\nСсылка: ${process.env.FRONTEND_URL}/projects/${projectData.id}`,
      startDate: projectData.workStartDate,
      endDate: projectData.workEndDate,
      colorId: projectData.status === 'work_completed' ? '10' : '8' // зеленый для завершенных, серый для остальных
    };

    // Создаем события в календарях бригады и фирмы
    const crewEventId = await googleCalendarService.createEvent(crew.gcalId, eventData);
    const masterEventId = await googleCalendarService.createEvent(firm.gcalMasterId, eventData);

    // Логируем операцию
    await googleCalendarService.logOperation({
      userId: user.id,
      action: 'sync_project',
      projectId: projectData.id,
      eventId: crewEventId,
      status: 'success',
      details: { 
        crewEventId, 
        masterEventId, 
        crewCalendarId: crew.gcalId,
        masterCalendarId: firm.gcalMasterId 
      }
    });

    res.json({ 
      message: 'Проект синхронизирован с календарем',
      crewEventId,
      masterEventId,
      crewCalendarUrl: googleCalendarService.getCalendarViewUrl(crew.gcalId),
      masterCalendarUrl: googleCalendarService.getCalendarViewUrl(firm.gcalMasterId)
    });
  } catch (error) {
    console.error('Error syncing project:', error);
    
    // Логируем ошибку
    if (req.user) {
      await googleCalendarService.logOperation({
        userId: req.user.id,
        action: 'sync_project',
        projectId: req.body.projectId || null,
        eventId: null,
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
    
    res.status(500).json({ message: 'Ошибка синхронизации проекта' });
  }
});

/**
 * Обновить список участников бригады и их доступ к календарю
 */
router.put('/crew/update-members', requireAuth, async (req, res) => {
  try {
    const { crewId, members } = updateCrewMembersSchema.parse(req.body);
    const user = req.user! as any;

    // Получаем информацию о бригаде
    const [crew] = await db.select()
      .from(crews)
      .where(eq(crews.id, crewId))
      .limit(1);
    
    if (!crew) {
      return res.status(404).json({ message: 'Бригада не найдена' });
    }

    if (!crew.gcalId) {
      return res.status(400).json({ message: 'У бригады нет календаря' });
    }

    // Проверяем права доступа
    if (user.role !== 'admin') {
      const [firmAccess] = await db.select()
        .from(firms)
        .where(eq(firms.id, crew.firmId))
        .limit(1);
      
      if (!firmAccess) {
        return res.status(403).json({ message: 'Доступ запрещен' });
      }
    }

    // Устанавливаем учетные данные фирмы
    await googleCalendarService.setFirmCredentials(crew.firmId);

    // Получаем текущих участников
    const currentMembers = await db.select()
      .from(crewMembers)
      .where(eq(crewMembers.crewId, crewId));

    // Обновляем участников в базе данных
    // Удаляем всех текущих участников
    await db.delete(crewMembers).where(eq(crewMembers.crewId, crewId));

    // Добавляем новых участников
    if (members.length > 0) {
      await db.insert(crewMembers).values(
        members.map(member => ({
          crewId,
          firstName: member.firstName,
          lastName: member.lastName,
          memberEmail: member.memberEmail,
          role: member.role,
          address: member.address,
          uniqueNumber: member.uniqueNumber,
          phone: member.phone
        }))
      );
    }

    // Обновляем доступ к календарю
    // Добавляем новых пользователей с email
    for (const member of members) {
      if (member.memberEmail) {
        try {
          await googleCalendarService.addCalendarUser(crew.gcalId, member.memberEmail, 'reader');
        } catch (error) {
          console.error(`Error adding member ${member.memberEmail} to calendar:`, error);
          // Не прерываем процесс, просто логируем ошибку
        }
      }
    }

    // Логируем операцию
    await googleCalendarService.logOperation({
      userId: user.id,
      action: 'update_crew_members',
      projectId: null,
      eventId: null,
      status: 'success',
      details: { crewId, updatedMembers: members.length }
    });

    res.json({ message: 'Участники бригады обновлены' });
  } catch (error) {
    console.error('Error updating crew members:', error);
    
    // Логируем ошибку
    if (req.user) {
      await googleCalendarService.logOperation({
        userId: req.user.id,
        action: 'update_crew_members',
        projectId: null,
        eventId: null,
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
    
    res.status(500).json({ message: 'Ошибка обновления участников бригады' });
  }
});

/**
 * Получить статус подключения Google Calendar для фирмы
 */
router.get('/status/:firmId', requireAuth, async (req, res) => {
  try {
    const { firmId } = connectGoogleSchema.parse(req.params);
    
    // Проверяем наличие токенов
    const [tokens] = await db.select()
      .from(googleTokens)
      .where(eq(googleTokens.firmId, firmId))
      .limit(1);

    // Получаем информацию о фирме
    const [firm] = await db.select()
      .from(firms)
      .where(eq(firms.id, firmId))
      .limit(1);

    res.json({
      isConnected: !!tokens,
      hasTokens: !!tokens,
      tokenExpiry: tokens?.expiry || null,
      hasMasterCalendar: !!firm?.gcalMasterId,
      masterCalendarId: firm?.gcalMasterId || null,
      masterCalendarUrl: firm?.gcalMasterId ? googleCalendarService.getCalendarViewUrl(firm.gcalMasterId) : null
    });
  } catch (error) {
    console.error('Error getting Google Calendar status:', error);
    res.status(500).json({ message: 'Ошибка получения статуса Google Calendar' });
  }
});

/**
 * Получить логи операций с календарем
 */
router.get('/logs/:projectId?', requireAuth, async (req, res) => {
  try {
    const projectId = req.params.projectId ? parseInt(req.params.projectId) : null;
    
    let query = db.select()
      .from(calendarLogs)
      .orderBy(calendarLogs.timestamp);

    if (projectId) {
      query = query.where(eq(calendarLogs.projectId, projectId)) as any;
    }

    const logs = await query.limit(100);
    
    res.json(logs);
  } catch (error) {
    console.error('Error getting calendar logs:', error);
    res.status(500).json({ message: 'Ошибка получения логов календаря' });
  }
});

export default router;