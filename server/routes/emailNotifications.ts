import { Router } from 'express';
import { emailNotificationService } from '../services/emailNotifications';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Схема для отправки уведомления о назначении проекта
const projectAssignmentSchema = z.object({
  projectId: z.number(),
  crewId: z.number(),
});

// Схема для отправки уведомления об изменении дат
const dateUpdateSchema = z.object({
  projectId: z.number(),
  crewId: z.number(),
  changeType: z.enum(['work_date', 'equipment_date']),
});

/**
 * Отправить уведомление о назначении проекта
 */
router.post('/project-assignment', requireAuth, async (req, res) => {
  try {
    const { projectId, crewId } = projectAssignmentSchema.parse(req.body);
    
    const success = await emailNotificationService.sendProjectAssignmentNotification(projectId, crewId);
    
    if (success) {
      res.json({ 
        message: 'Уведомления отправлены участникам бригады',
        sent: true 
      });
    } else {
      res.json({ 
        message: 'Уведомления не отправлены (нет email адресов или отключен SendGrid)',
        sent: false 
      });
    }
  } catch (error) {
    console.error('Error sending project assignment notification:', error);
    res.status(500).json({ 
      message: 'Ошибка отправки уведомлений',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Отправить уведомление об изменении дат
 */
router.post('/date-update', requireAuth, async (req, res) => {
  try {
    const { projectId, crewId, changeType } = dateUpdateSchema.parse(req.body);
    
    const success = await emailNotificationService.sendProjectDateUpdateNotification(projectId, crewId, changeType);
    
    if (success) {
      res.json({ 
        message: 'Уведомления об изменении дат отправлены',
        sent: true 
      });
    } else {
      res.json({ 
        message: 'Уведомления не отправлены (нет email адресов или отключен SendGrid)',
        sent: false 
      });
    }
  } catch (error) {
    console.error('Error sending date update notification:', error);
    res.status(500).json({ 
      message: 'Ошибка отправки уведомлений',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Отправить уведомление о готовности оборудования
 */
router.post('/equipment-ready', requireAuth, async (req, res) => {
  try {
    const { projectId, crewId } = projectAssignmentSchema.parse(req.body);
    
    const success = await emailNotificationService.sendEquipmentReadyNotification(projectId, crewId);
    
    if (success) {
      res.json({ 
        message: 'Уведомления о готовности оборудования отправлены',
        sent: true 
      });
    } else {
      res.json({ 
        message: 'Уведомления не отправлены (нет email адресов или отключен SendGrid)',
        sent: false 
      });
    }
  } catch (error) {
    console.error('Error sending equipment ready notification:', error);
    res.status(500).json({ 
      message: 'Ошибка отправки уведомлений',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;