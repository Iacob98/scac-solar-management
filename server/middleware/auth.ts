import type { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import type { User } from '@shared/schema';

// Расширяем интерфейс Request для включения пользователя
// Note: Express Request.user type is declared in supabaseAuth.ts

/**
 * Middleware для проверки аутентификации
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userId: string | null = null;

    // Проверяем Replit Auth
    if (req.user?.claims?.sub) {
      userId = req.user.claims.sub;
    }
    // Проверяем тестовую сессию (для разработки)
    else if (req.session?.userId) {
      userId = req.session.userId;
    }

    if (!userId) {
      return res.status(401).json({ message: 'Требуется аутентификация' });
    }

    // Получаем данные пользователя из базы
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    // Добавляем пользователя в объект запроса
    req.user = user;

    next();
  } catch (error) {
    console.error('Ошибка в middleware аутентификации:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Middleware для проверки роли администратора
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  // Сначала проверяем аутентификацию
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Требуются права администратора' });
    }
    next();
  });
};

/**
 * Middleware для проверки доступа к фирме
 */
export const requireFirmAccess = (firmIdParam: string = 'firmId') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = req.params[firmIdParam] || req.body[firmIdParam];
      
      if (!firmId) {
        return res.status(400).json({ message: 'ID фирмы не указан' });
      }

      // Админы имеют доступ ко всем фирмам
      if (req.user?.role === 'admin') {
        return next();
      }

      // Для лейтеров проверяем доступ к фирме
      const hasAccess = await storage.hasUserFirmAccess(req.user!.id, firmId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Нет доступа к данной фирме' });
      }

      next();
    } catch (error) {
      console.error('Ошибка в middleware доступа к фирме:', error);
      res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  };
};