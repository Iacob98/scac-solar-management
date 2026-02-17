import { Router, Response } from 'express';
import { storage } from '../storage';
import { AuthenticatedRequest } from '../middleware/supabaseAuth';

const router = Router();

// GET /api/notifications - получить уведомления текущего пользователя
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const notifications = await storage.getUserNotifications(req.user.id, limit);

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Ошибка получения уведомлений' });
  }
});

// GET /api/notifications/unread-count - получить количество непрочитанных
router.get('/unread-count', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const count = await storage.getUnreadNotificationCount(req.user.id);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Ошибка получения счетчика уведомлений' });
  }
});

// PATCH /api/notifications/:id/read - отметить как прочитанное
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const notificationId = parseInt(req.params.id);
    const notification = await storage.markNotificationRead(notificationId);

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Ошибка при обновлении уведомления' });
  }
});

// POST /api/notifications/read-all - отметить все как прочитанные
router.post('/read-all', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await storage.markAllNotificationsRead(req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Ошибка при обновлении уведомлений' });
  }
});

// DELETE /api/notifications/:id - удалить уведомление
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const notificationId = parseInt(req.params.id);
    await storage.deleteNotification(notificationId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Ошибка при удалении уведомления' });
  }
});

export default router;
