# Архитектура проекта SCAC

**Дата создания:** 2025-07-24  
**Версия:** 2.0 (после рефакторинга)

## Обзор системы

SCAC (Solar Crew Assignment Control) - комплексная платформа управления проектами солнечных установок с интеграцией Invoice Ninja, Postmark и Google Calendar.

## Архитектурные принципы

### 1. Feature-First структура
- Код организован по бизнес-функциям, не по техническим слоям
- Каждая фича содержит все необходимые компоненты (UI, API, типы, логика)
- Общие компоненты выносятся в `/shared`

### 2. Контроль размера файлов
- Максимум 300 строк на файл (исключая схемы БД)
- Максимум 80 строк на функцию
- Автоматическая проверка через ESLint

### 3. Документация на русском
- JSDoc комментарии для всех публичных функций
- Шапки файлов с описанием назначения
- README для каждого модуля

## Структура фронтенда

```
client/src/
├── app/                    # Точка входа, провайдеры
│   ├── providers/
│   ├── router/
│   └── App.tsx
├── shared/                 # Общие компоненты и утилиты
│   ├── ui/                 # UI компоненты (Button, Input и т.д.)
│   ├── hooks/              # Общие хуки (useAuth, useQuery)
│   ├── lib/                # Утилиты (queryClient, axios)
│   └── types/              # Общие типы
└── features/               # Бизнес-функции
    ├── auth/
    ├── projects/
    ├── crews/
    ├── invoices/
    ├── firms/
    └── calendar/
```

## Структура бэкенда

```
server/
├── config/                 # Конфигурация (env, logger)
├── modules/                # Бизнес-модули
│   ├── auth/
│   ├── projects/
│   ├── crews/
│   ├── invoices/
│   └── calendar/
├── shared/                 # Общие сервисы и утилиты
│   ├── middlewares/
│   ├── errors/
│   └── utils/
└── db/                     # База данных
    └── schema.ts
```

## Слои в модулях

### Фронтенд модуль
- `api/` - React Query хуки для запросов
- `components/` - UI компоненты
- `hooks/` - Бизнес-логика и состояние  
- `pages/` - Страницы (роуты)
- `utils/` - Утилиты и расчеты
- `types.ts` - TypeScript интерфейсы

### Бэкенд модуль
- `controller.ts` - HTTP обработчики
- `service.ts` - Бизнес-логика
- `repository.ts` - Доступ к БД
- `routes.ts` - Маршруты
- `schema.ts` - Zod схемы валидации
- `types.ts` - TypeScript интерфейсы

## Ключевые технологии

- **Frontend:** React 18, TypeScript, TanStack Query, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM
- **Database:** PostgreSQL (Neon)
- **External APIs:** Invoice Ninja, Postmark, Google Calendar

## Интеграции

1. **Invoice Ninja** - автоматическое создание и управление счетами
2. **Postmark** - отправка счетов клиентам по email
3. **Google Calendar** - создание событий для бригад
4. **Replit Auth** - аутентификация пользователей

## Состояние рефакторинга

- [x] Настроена конфигурация ESLint
- [x] Создана базовая документация
- [ ] Рефакторинг модуля Projects
- [ ] Рефакторинг модуля Crews  
- [ ] Рефакторинг модуля Invoices
- [ ] Рефакторинг модуля Firms
- [ ] Рефакторинг модуля Calendar
- [ ] Настройка TypeDoc
- [ ] Обновление README модулей