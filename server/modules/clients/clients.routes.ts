/**
 * Файл: server/modules/clients/clients.routes.ts
 * Назначение: Маршруты для управления клиентами
 * Используется в: registerRoutes в главном файле
 * Зависимости: clients.controller.ts, isAuthenticated middleware
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { Router } from 'express';
import { isAuthenticated } from '../../replitAuth';
import {
  getClients,
  getClientById,
  updateClient,
  createClient
} from './clients.controller';

const router = Router();

// ----- Основные маршруты клиентов -----

/**
 * GET /api/clients
 * Получить список клиентов фирмы с синхронизацией из Invoice Ninja
 */
router.get('/', isAuthenticated, getClients);

/**
 * GET /api/clients/single/:id
 * Получить клиента по ID
 */
router.get('/single/:id', isAuthenticated, getClientById);

/**
 * POST /api/clients
 * Создать нового клиента с синхронизацией в Invoice Ninja
 */
router.post('/', isAuthenticated, createClient);

/**
 * PATCH /api/clients/:id
 * Обновить данные клиента
 */
router.patch('/:id', isAuthenticated, updateClient);

export default router;