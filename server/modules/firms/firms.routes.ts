/**
 * Файл: server/modules/firms/firms.routes.ts
 * Назначение: Маршруты для управления фирмами
 * Используется в: registerRoutes в главном файле
 * Зависимости: firms.controller.ts, isAuthenticated middleware
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { Router } from 'express';
import { isAuthenticated } from '../../replitAuth';
import {
  getUserFirms,
  getFirmById,
  createFirm,
  updateFirm,
  testInvoiceNinjaConnection
} from './firms.controller';

const router = Router();

// ----- Основные маршруты фирм -----

/**
 * GET /api/firms
 * Получить список фирм пользователя
 */
router.get('/', isAuthenticated, getUserFirms);

/**
 * GET /api/firms/:id
 * Получить фирму по ID
 */
router.get('/:id', isAuthenticated, getFirmById);

/**
 * POST /api/firms
 * Создать новую фирму (только администраторы)
 */
router.post('/', isAuthenticated, createFirm);

/**
 * PATCH /api/firms/:id
 * Обновить данные фирмы (только администраторы)
 */
router.patch('/:id', isAuthenticated, updateFirm);

/**
 * POST /api/firms/test-connection
 * Протестировать соединение с Invoice Ninja
 */
router.post('/test-connection', isAuthenticated, testInvoiceNinjaConnection);

export default router;