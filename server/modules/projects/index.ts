/**
 * Файл: server/modules/projects/index.ts
 * Назначение: Точка входа для модуля проектов
 * Экспортирует: маршруты, контроллеры
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

export { default as projectsRoutes } from './projects.routes';
export * from './projects.controller';