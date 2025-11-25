# SCAC Project - Context Analysis

## Обзор проекта

**Название:** SCAC (Solar Crew Management System)
**Тип:** Full-Stack Web Application для управления проектами установки солнечных панелей
**Текущая инфраструктура:** Replit + Neon PostgreSQL
**Размер:** ~326MB (без node_modules и .git)

---

## Текущий стек технологий

### Backend
- **Framework:** Express.js (Node.js) с TypeScript
- **База данных:** PostgreSQL (Neon serverless) через @neondatabase/serverless
- **ORM:** Drizzle ORM 0.39.1
- **Авторизация:** Replit Auth (OpenID Connect)
- **Сессии:** PostgreSQL через connect-pg-simple
- **Runtime:** Node 20

### Frontend
- **Framework:** React 18.3.1 с TypeScript
- **UI:** Shadcn/ui + Radix UI + Tailwind CSS
- **Сборка:** Vite 5.4.19
- **Роутинг:** React Router 7.2.1

### Внешние сервисы
1. **Invoice Ninja** - управление счетами
2. **Google Calendar** - планирование работ
3. **SendGrid** - email уведомления
4. **Postmark** - доставка счетов по email
5. **Replit OIDC** - авторизация

---

## Структура базы данных

### 22 таблицы (PostgreSQL):

#### Основные таблицы
1. **users** - пользователи системы
   - Поля: id, email, firstName, lastName, profileImageUrl, role, createdAt, updatedAt
   - Роли: "admin" | "leiter" (менеджер проектов)

2. **sessions** - сессии Replit Auth
   - Поля: sid (PK), sess (jsonb), expire
   - TTL: 7 дней

3. **firms** - компании/организации
   - Поля: id, name, invoiceNinjaUrl, token, address, taxId, logoUrl
   - Email настройки: postmarkServerToken, postmarkFromEmail, emailSubjectTemplate, emailBodyTemplate
   - Google Calendar: calendarEventTitle, calendarEventDescription

4. **user_firms** - связь пользователей с фирмами (many-to-many)

5. **clients** - клиенты (связь с Invoice Ninja)
   - Поля: id, firmId, ninjaClientId, name, email, address, phone

6. **crews** - бригады рабочих
   - Поля: id, firmId, name, uniqueNumber, leaderName, phone, address, status, gcalId
   - Статусы: "active" | "vacation" | "equipment_issue" | "unavailable"

7. **crew_members** - члены бригады
   - Поля: id, crewId, firstName, lastName, uniqueNumber, phone, role, memberEmail, googleCalendarId
   - Роли: "leader" | "worker" | "specialist"

8. **projects** - проекты установки
   - Поля: id, firmId, clientId, leiterId, crewId
   - Статусы: "planning" → "equipment_waiting" → "equipment_arrived" → "work_scheduled" → "work_in_progress" → "work_completed" → "invoiced" → "invoice_sent" → "paid"
   - Даты: equipmentExpectedDate, equipmentArrivedDate, workStartDate, workEndDate
   - Токен для загрузки фото: crewUploadToken, crewUploadTokenExpires

9. **services** - позиции счета (работы/материалы)
   - Поля: id, projectId, productKey, description, price, quantity, isCustom

10. **invoices** - счета
    - Поля: id, projectId, invoiceId, invoiceNumber, invoiceDate, dueDate, totalAmount, isPaid, status
    - Статусы: "draft" | "sent" | "viewed" | "partial" | "paid" | "overdue"

11. **file_storage** - файлы проекта
    - Поля: id, fileId (UUID), originalName, fileName, mimeType, size, category, projectId, uploadedBy, uploadedAt, isDeleted, deletedAt
    - Категории: "project_file" | "report" | "invoice" | "document" | "image" | "profile"

12. **project_reports** - отчеты о выполнении
    - Поля: id, projectId, rating (1-5), reviewText, reviewDocumentUrl, completedAt

13. **project_notes** - заметки по проекту
    - Поля: id, projectId, userId, content, priority, createdAt
    - Приоритеты: "normal" | "important" | "urgent" | "critical"

14. **project_history** - история изменений проекта (audit trail)
    - Поля: id, projectId, userId, changeType, fieldName, oldValue, newValue, description, timestamp
    - Типы изменений: status_change, date_update, info_update, created, equipment_update, call_update, assignment_change, shared, file_added, file_deleted, report_added, note_added, crew_assigned

15. **crew_history** - история изменений бригады
    - Поля: id, crewId, changeType, memberId, memberName, memberSpecialization

16. **project_crew_snapshots** - снимки состава бригады на момент проекта
    - Поля: id, projectId, crewId, snapshotDate, crewData (jsonb), membersData (jsonb)

17. **project_shares** - совместный доступ к проектам
    - Поля: id, projectId, sharedBy, sharedWith, permission, createdAt
    - Права: "view" | "edit"

18. **google_calendar_settings** - настройки Google Calendar
    - Поля: id, firmId, clientId, clientSecret, redirectUri, masterCalendarId

19. **google_tokens** - OAuth2 токены для Google Calendar
    - Поля: id, firmId, accessToken, refreshToken, expiry, createdAt, updatedAt

20. **calendar_logs** - логи операций с календарем
    - Поля: id, timestamp, userId, action, projectId, eventId, status, details (jsonb)

#### Legacy таблицы
21. **project_files** - старая система хранения файлов (заменена на file_storage)
22. **invoice_queue** - очередь обработки счетов

---

## Текущая авторизация (Replit Auth)

### Принцип работы
1. **Протокол:** OpenID Connect (OIDC)
2. **Provider:** Replit (https://replit.com/oidc)
3. **Файлы:**
   - `/server/replitAuth.ts` - настройка и middleware (191 строка)
   - `/server/middleware/auth.ts` - кастомные middleware (92 строки)

### Эндпоинты авторизации
```
GET  /api/login          - начало OAuth2 flow
GET  /api/callback       - callback после авторизации
GET  /api/logout         - выход из системы
POST /api/auth/test-login - тестовый вход (для разработки)
```

### Структура сессии
```typescript
user: {
  claims: {
    sub,              // уникальный ID пользователя
    email,
    first_name,
    last_name,
    profile_image_url,
    exp              // время истечения токена
  },
  access_token,
  refresh_token,
  expires_at
}
```

### Middleware цепочка
1. **isAuthenticated** - проверка Replit Auth или тестовой сессии
   - Валидация истечения токена
   - Автоматический refresh токенов
   - Возвращает 401 при ошибке

2. **requireAuth** - загрузка пользователя из БД
   - Проверка существования пользователя
   - Добавление объекта user в request

3. **requireAdmin** - проверка роли администратора
   - Проверка user.role === 'admin'
   - Возвращает 403 если не admin

4. **requireFirmAccess** - проверка доступа к фирме
   - Admins имеют доступ ко всем фирмам
   - Leiters проверяются через user_firms таблицу

### Хранение сессий
- **Где:** PostgreSQL (таблица sessions)
- **Store:** connect-pg-simple
- **TTL:** 7 дней (604800000ms)
- **Cookies:** httpOnly, secure (в продакшене)
- **Secret:** переменная окружения SESSION_SECRET

### Модель авторизации
- **Роли:** "admin" или "leiter"
- **Доступ к фирмам:** через таблицу user_firms
- **Доступ к проектам:** через таблицу project_shares с правами view/edit

---

## API эндпоинты (60+ маршрутов)

### Группы эндпоинтов:
1. **Auth** - авторизация и профиль пользователя (7 эндпоинтов)
2. **Users** - управление пользователями (2 эндпоинта)
3. **Firms** - управление фирмами (10 эндпоинтов)
4. **Clients** - управление клиентами (4 эндпоинта)
5. **Crews** - управление бригадами (10 эндпоинтов)
6. **Crew Members** - члены бригад (4 эндпоинта)
7. **Projects** - проекты (15+ эндпоинтов)
8. **Services** - позиции счета (4 эндпоинта)
9. **Invoices** - счета и платежи (6 эндпоинтов)
10. **Files** - загрузка и управление файлами (5 эндпоинтов)
11. **Reports** - отчеты о выполнении (3 эндпоинта)
12. **Google Calendar** - интеграция с календарем (8 эндпоинтов)
13. **Notifications** - email уведомления (3 эндпоинта)

---

## Критичные файлы

| Файл | Назначение | Строки |
|------|-----------|--------|
| `/server/db.ts` | Подключение к PostgreSQL | 15 |
| `/server/index.ts` | Entry point сервера | 79 |
| `/server/routes.ts` | Все API маршруты | 3120 |
| `/server/storage.ts` | Database ORM операции | 2000+ |
| `/server/replitAuth.ts` | Replit Auth setup | 191 |
| `/server/middleware/auth.ts` | Auth middleware | 92 |
| `/shared/schema.ts` | Drizzle схема БД | 500+ |
| `/server/services/invoiceNinja.ts` | Invoice Ninja API | 400+ |
| `/server/services/googleCalendar.ts` | Google Calendar API | 500+ |
| `/server/services/emailNotifications.ts` | SendGrid emails | 300+ |
| `/server/services/postmark.ts` | Postmark emails | 123 |
| `/client/src/App.tsx` | React entry point | 100+ |
| `/package.json` | Зависимости проекта | 125 |
| `/.replit` | Replit конфигурация | 44 |
| `/drizzle.config.ts` | Drizzle ORM config | 14 |

---

## Зависимости от Replit

### Критичные зависимости:
1. **Авторизация:**
   - Replit OIDC (openid-client пакет)
   - Требует REPL_ID, REPLIT_DOMAINS
   - Hardcoded issuer: https://replit.com/oidc

2. **URL генерация:**
   - Использует REPLIT_DOMAINS или REPL_SLUG + REPL_OWNER
   - Fallback на hardcoded URLs (scac.app)
   - Затрагивает OAuth callbacks, email ссылки

3. **Deployment:**
   - .replit файл конфигурирует PostgreSQL 16 + Node 20
   - Autoscale deployment
   - Порт 5000 → внешний 80

4. **Dev plugins:**
   - @replit/vite-plugin-cartographer
   - @replit/vite-plugin-runtime-error-modal

---

## Environment переменные

### Обязательные:
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `SESSION_SECRET` - секрет для сессий
- `REPL_ID` - Replit app ID (для OIDC)
- `REPLIT_DOMAINS` - список доменов

### Опциональные:
- `ISSUER_URL` - OIDC issuer (default: https://replit.com/oidc)
- `NODE_ENV` - development/production
- `INVOICE_NINJA_URL` - URL Invoice Ninja (или в firms)
- `INVOICE_NINJA_API_KEY` - API ключ (или в firms)
- `SENDGRID_API_KEY` - SendGrid для уведомлений
- `GOOGLE_CLIENT_ID` - Google OAuth (или в google_calendar_settings)
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret

---

## AI/LLM интеграции

**НЕТ AI/LLM интеграций** в текущем проекте.

Приложение не использует:
- OpenAI API
- Anthropic Claude API
- Какие-либо LLM модели
- Agent orchestration

---

## Проблемы текущей реализации

### 1. Vendor Lock-in
- Привязка к Replit Auth (OIDC)
- Нельзя развернуть вне Replit без изменений
- Хардкодед конфигурация в .replit

### 2. Масштабируемость
- Neon serverless PostgreSQL (ограничения free tier)
- Нет connection pooling для высоких нагрузок
- Один регион (от Neon)

### 3. Безопасность
- Токены в переменных окружения (не encrypted)
- Нет rate limiting
- Нет 2FA

### 4. Отказоустойчивость
- Зависимость от Replit uptime
- Нет backup стратегии
- Одна точка отказа (БД)

---

## Что нужно мигрировать

### 1. База данных: Neon → Supabase
- 22 таблицы
- Все индексы
- Foreign keys
- Enum типы
- Миграции (Drizzle)

### 2. Авторизация: Replit Auth → Supabase Auth
- OAuth2/OIDC flow
- Session management
- User profiles
- Role-based access (admin/leiter)
- Firm-based access control

### 3. File Storage: Локальное → Supabase Storage
- Текущие файлы (~326MB)
- Upload endpoints
- Download/serving логика
- Категории файлов

### 4. Realtime Features (опционально)
- Можно добавить Supabase Realtime для:
  - Live обновления проектов
  - Уведомления в реальном времени
  - Collaborative editing

### 5. Деплой: Replit → Независимый хостинг
- Vercel/Netlify для фронтенда
- Railway/Render/DigitalOcean для бэкенда
- Supabase для БД и Auth

---

## Выводы

Проект хорошо структурирован и готов к production, но имеет критическую зависимость от Replit инфраструктуры. Миграция на Supabase решит проблемы:
- **Vendor lock-in** - можно развернуть где угодно
- **Масштабируемость** - Supabase масштабируется автоматически
- **Безопасность** - встроенные механизмы Supabase (RLS, JWT)
- **Стоимость** - predictable pricing, free tier щедрее

Следующий шаг: детальный план миграции в `fix.md`.
