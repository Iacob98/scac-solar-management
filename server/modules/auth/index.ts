/**
 * Файл: server/modules/auth/index.ts
 * Назначение: Точка входа для модуля аутентификации
 * Экспортирует: маршруты, контроллеры, сервисы
 * Автор: Система рефакторинга SCAC
 * Последнее изменение: 2025-07-24
 */

export { default as authRoutes } from './auth.routes';
export { authService } from './auth.service';
export * from './auth.controller';