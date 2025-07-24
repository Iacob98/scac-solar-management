/**
 * Файл: server/modules/crews/crews.routes.ts
 * Назначение: Маршруты для управления бригадами
 * Используется в: registerRoutes в главном файле
 * Зависимости: crews.controller.ts, isAuthenticated middleware
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { Router } from 'express';
import { isAuthenticated } from '../../replitAuth';
import {
  getCrews,
  getCrewById,
  createCrew,
  updateCrew,
  deleteCrew,
  getCrewsStatsSummary,
  getCrewStats
} from './crews.controller';

const router = Router();

// ----- Основные маршруты бригад -----

/**
 * GET /api/crews
 * Получить список бригад для фирмы
 */
router.get('/', isAuthenticated, getCrews);

/**
 * GET /api/crews/single/:id
 * Получить бригаду по ID
 */
router.get('/single/:id', isAuthenticated, getCrewById);

/**
 * POST /api/crews
 * Создать новую бригаду
 */
router.post('/', isAuthenticated, createCrew);

/**
 * PUT /api/crews/:id
 * Обновить бригаду (полное обновление)
 */
router.put('/:id', isAuthenticated, updateCrew);

/**
 * PATCH /api/crews/:id
 * Обновить бригаду (частичное обновление)
 */
router.patch('/:id', isAuthenticated, updateCrew);

/**
 * DELETE /api/crews/:id
 * Удалить бригаду
 */
router.delete('/:id', isAuthenticated, deleteCrew);

// ----- Маршруты статистики бригад -----

/**
 * GET /api/crews/stats/summary
 * Получить сводную статистику по всем бригадам
 */
router.get('/stats/summary', isAuthenticated, getCrewsStatsSummary);

/**
 * GET /api/crews/:id/stats
 * Получить детальную статистику по бригаде
 */
router.get('/:id/stats', isAuthenticated, getCrewStats);

export default router;