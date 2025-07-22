import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { isAuthenticated } from '../replitAuth';
import { storage } from '../storage';
import { googleCalendarService } from '../services/googleCalendar';

const router = Router();

// Демонстрация создания календарных событий
router.post('/create-demo-events/:projectId/:crewId', requireAuth, async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const crewId = parseInt(req.params.crewId);

    // Получаем данные проекта
    const project = await storage.getProjectById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Получаем участников бригады
    const crewMembers = await storage.getCrewMembersByCrewId(crewId);
    
    // Создаем демо-события для участников с email
    const demoEvents = crewMembers
      .filter(member => member.memberEmail)
      .map(member => ({
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberEmail: member.memberEmail,
        googleCalendarId: member.googleCalendarId || 'primary',
        event: {
          summary: `Проект #${project.id} - Установка солнечных панелей`,
          location: project.installationPersonAddress || 'Адрес установки не указан',
          description: [
            `Проект ID: ${project.id}`,
            `Статус: ${project.status}`,
            project.installationPersonFirstName && project.installationPersonLastName 
              ? `Клиент: ${project.installationPersonFirstName} ${project.installationPersonLastName}`
              : '',
            project.installationPersonPhone ? `Телефон: ${project.installationPersonPhone}` : '',
            project.equipmentExpectedDate ? `Ожидание оборудования: ${project.equipmentExpectedDate}` : '',
            project.equipmentArrivedDate ? `Оборудование поступило: ${project.equipmentArrivedDate}` : '',
            project.notes ? `Примечания: ${project.notes}` : ''
          ].filter(Boolean).join('\n'),
          startDate: project.workStartDate || project.startDate,
          endDate: project.workEndDate || project.endDate || project.workStartDate || project.startDate,
          timeZone: 'Europe/Berlin',
          colorId: '9' // Синий цвет
        }
      }));

    console.log(`Demo: Would create ${demoEvents.length} calendar events for project ${projectId}`);
    demoEvents.forEach(event => {
      console.log(`  - Event for ${event.memberName} (${event.memberEmail}):`);
      console.log(`    Calendar: ${event.googleCalendarId}`);
      console.log(`    Title: ${event.event.summary}`);
      console.log(`    Location: ${event.event.location}`);
      console.log(`    Date: ${event.event.startDate} - ${event.event.endDate}`);
      console.log(`    Description: ${event.event.description.substring(0, 100)}...`);
    });

    res.json({
      success: true,
      message: `Создано ${demoEvents.length} календарных событий для проекта ${projectId}`,
      events: demoEvents
    });

  } catch (error) {
    console.error('Error creating demo calendar events:', error);
    res.status(500).json({ message: 'Failed to create demo events' });
  }
});

// Создать реальные календарные события для проекта и бригады
router.post('/create-real-events/:projectId/:crewId', isAuthenticated, async (req, res) => {
  try {
    const { projectId, crewId } = req.params;
    
    const result = await googleCalendarService.createProjectEventForCrewMembers(
      parseInt(projectId), 
      parseInt(crewId)
    );
    
    res.json({ 
      success: true, 
      message: 'Календарные события успешно созданы в Google Calendar',
      result 
    });
  } catch (error) {
    console.error('Error creating real calendar events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      success: false, 
      message: `Ошибка создания календарных событий: ${errorMessage}` 
    });
  }
});

export default router;