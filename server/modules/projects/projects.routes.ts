/**
 * Файл: server/modules/projects/projects.routes.ts
 * Назначение: Маршруты для управления проектами
 * Используется в: registerRoutes в главном файле
 * Зависимости: projects.controller.ts, isAuthenticated middleware
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

import { Router } from 'express';
import { isAuthenticated } from '../../replitAuth';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
} from './projects.controller';

const router = Router();

// ----- Основные маршруты проектов -----

/**
 * GET /api/projects
 * Получить список проектов для фирмы
 */
router.get('/', isAuthenticated, getProjects);

/**
 * GET /api/projects/:id
 * Получить проект по ID
 */
router.get('/:id', isAuthenticated, getProjectById);

/**
 * POST /api/projects
 * Создать новый проект
 */
router.post('/', isAuthenticated, createProject);

/**
 * PATCH /api/projects/:id
 * Обновить проект
 */
router.patch('/:id', isAuthenticated, updateProject);

/**
 * DELETE /api/projects/:id
 * Удалить проект
 */
router.delete('/:id', isAuthenticated, deleteProject);

export default router;