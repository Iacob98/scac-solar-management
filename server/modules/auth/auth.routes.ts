/**
 * Файл: server/modules/auth/auth.routes.ts
 * Назначение: Маршруты для аутентификации пользователей
 * Используется в: registerRoutes в главном файле
 * Зависимости: auth.controller.ts, isAuthenticated middleware
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { Router } from 'express';
import { isAuthenticated } from '../../replitAuth';
import {
  getCurrentUser,
  getTestUsers,
  loginAsTestUser,
  logout
} from './auth.controller';

const router = Router();

// ----- Основные маршруты аутентификации -----

/**
 * GET /api/auth/user
 * Получить информацию о текущем пользователе
 */
router.get('/user', isAuthenticated, getCurrentUser);

/**
 * GET /api/auth/test-users  
 * Получить список тестовых пользователей (только для разработки)
 */
router.get('/test-users', getTestUsers);

/**
 * POST /api/auth/test-login
 * Войти как тестовый пользователь (только для разработки)
 */
router.post('/test-login', loginAsTestUser);

/**
 * POST /api/auth/logout
 * Выйти из системы
 */
router.post('/logout', logout);

export default router;