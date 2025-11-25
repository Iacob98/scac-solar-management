# Supabase Migration Guide

## Предварительные требования

1. **Docker** - для запуска локального Supabase
2. **Supabase CLI** - для управления миграциями

```bash
# Установка Supabase CLI (если еще не установлен)
npm install -g supabase

# Или через Homebrew (macOS)
brew install supabase/tap/supabase
```

## Запуск локального Supabase

### 1. Инициализация Supabase проекта

```bash
# В корне проекта
supabase init
```

Эта команда создаст папку `supabase/` с конфигурацией.

### 2. Запуск локального Supabase

```bash
supabase start
```

Эта команда:
- Запустит Docker контейнеры (PostgreSQL, Auth, Storage, Realtime, etc.)
- Выведет credentials для локального доступа
- По умолчанию БД будет доступна на `localhost:54322`
- API будет на `http://localhost:54321`

**Важно:** Сохраните credentials которые выведет команда!

Пример вывода:
```
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Обновление .env файла

Обновите ваш `.env` файл с полученными credentials:

```bash
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<anon key из вывода>
SUPABASE_SERVICE_KEY=<service_role key из вывода>
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## Применение миграций

### Вариант 1: Через Supabase CLI (рекомендуется)

```bash
# Применить все миграции
supabase db push

# Или применить конкретную миграцию
supabase migration up
```

### Вариант 2: Через SQL Editor в Supabase Studio

1. Откройте Supabase Studio: http://localhost:54323
2. Перейдите в SQL Editor
3. Скопируйте содержимое файла `migrations/20250124000000_initial_schema.sql`
4. Выполните SQL

### Вариант 3: Через psql

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/migrations/20250124000000_initial_schema.sql
```

## Проверка миграций

### 1. Проверка через Supabase Studio

Откройте http://localhost:54323 и проверьте:
- **Table Editor**: Должны появиться все таблицы (profiles, firms, projects, etc.)
- **Database > Schemas > public**: Проверьте структуру таблиц
- **Authentication > Policies**: Проверьте RLS политики

### 2. Проверка через psql

```bash
psql postgresql://postgres:postgres@localhost:54322/postgres

# Список таблиц
\dt public.*

# Описание таблицы profiles
\d public.profiles

# Проверка триггеров
\df public.handle_new_user

# Проверка RLS политик
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

### 3. Проверка через код

Создайте тестовый скрипт `test-supabase.ts`:

```typescript
import { supabase } from './server/supabaseClient.js';

async function testSupabase() {
  console.log('Testing Supabase connection...');

  // Тест 1: Проверка подключения
  const { data: tables, error } = await supabase
    .from('profiles')
    .select('count')
    .single();

  if (error) {
    console.error('Connection error:', error);
    return;
  }

  console.log('✓ Connection successful!');

  // Тест 2: Создание тестового пользователя
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'test@example.com',
    password: 'test123456',
    email_confirm: true,
    user_metadata: {
      first_name: 'Test',
      last_name: 'User'
    }
  });

  if (authError) {
    console.error('User creation error:', authError);
    return;
  }

  console.log('✓ Test user created:', authData.user.id);

  // Тест 3: Проверка автоматического создания profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError) {
    console.error('Profile check error:', profileError);
    return;
  }

  console.log('✓ Profile auto-created:', profile);

  // Cleanup
  await supabase.auth.admin.deleteUser(authData.user.id);
  console.log('✓ Test user cleaned up');

  console.log('\n✅ All tests passed!');
}

testSupabase();
```

Запустите:
```bash
tsx test-supabase.ts
```

## Остановка локального Supabase

```bash
supabase stop
```

Для полной очистки (удалит все данные):
```bash
supabase stop --no-backup
```

## Подключение к production Supabase

### 1. Создайте проект на supabase.com

1. Зайдите на https://supabase.com
2. Создайте новый проект
3. Выберите регион (ближе к вашим пользователям)
4. Сохраните Database Password!

### 2. Получите credentials

В Supabase Dashboard:
- Project Settings > API
- Скопируйте:
  - Project URL
  - anon/public key
  - service_role key (храните в секрете!)

### 3. Примените миграции

```bash
# Свяжите локальный проект с production
supabase link --project-ref your-project-ref

# Примените миграции
supabase db push
```

### 4. Обновите production .env

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_DB_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
```

## Troubleshooting

### Ошибка: "Docker is not running"

Убедитесь что Docker Desktop запущен:
```bash
docker ps
```

### Ошибка: "Port already in use"

Другой процесс использует порт. Остановите его или измените порт в `supabase/config.toml`:

```toml
[api]
port = 54321

[db]
port = 54322
```

### Ошибка: "Migration failed"

Проверьте синтаксис SQL:
```bash
# Проверить миграцию без применения
supabase migration verify
```

### Таблицы не видны в Studio

Обновите страницу или проверьте:
```bash
supabase db reset  # ВНИМАНИЕ: Удалит все данные!
```

## Полезные команды

```bash
# Статус локального Supabase
supabase status

# Логи
supabase logs

# Сброс базы данных
supabase db reset

# Создание новой миграции
supabase migration new migration_name

# Список миграций
supabase migration list

# Откат последней миграции
supabase migration down

# Открыть Studio
supabase studio
```

## Следующие шаги

После успешного применения миграций:

1. ✅ Обновить `server/storage.ts` для использования Supabase клиента
2. ✅ Заменить Replit Auth на Supabase Auth в `server/routes.ts`
3. ✅ Обновить фронтенд для работы с Supabase Auth
4. ✅ Мигрировать файлы в Supabase Storage
5. ✅ Тестировать все функции приложения
6. ✅ Деплой на production

См. подробный план в `/fix.md`
