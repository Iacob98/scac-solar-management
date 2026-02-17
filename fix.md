# План миграции SCAC: Replit → Supabase

## Цель миграции

Переход с Replit инфраструктуры на Supabase для устранения vendor lock-in и улучшения масштабируемости, безопасности и стоимости эксплуатации.

---

## Фазы миграции

### Фаза 1: Подготовка и настройка Supabase
### Фаза 2: Миграция базы данных
### Фаза 3: Миграция авторизации
### Фаза 4: Миграция файлового хранилища
### Фаза 5: Рефакторинг кода
### Фаза 6: Тестирование
### Фаза 7: Деплой и переход

---

## ФАЗА 1: Подготовка и настройка Supabase

### 1.1 Создание Supabase проекта

```bash
# 1. Зарегистрироваться на supabase.com
# 2. Создать новый проект (выбрать регион близко к пользователям)
# 3. Сохранить credentials:
#    - Project URL
#    - API Keys (anon public, service_role secret)
#    - Database connection string
```

### 1.2 Установка Supabase CLI

```bash
npm install -g supabase
supabase login
supabase init
```

### 1.3 Обновление зависимостей

```bash
# Удалить Replit-специфичные пакеты
npm uninstall @replit/vite-plugin-cartographer @replit/vite-plugin-runtime-error-modal

# Удалить Neon PostgreSQL driver
npm uninstall @neondatabase/serverless

# Установить Supabase клиенты
npm install @supabase/supabase-js @supabase/auth-helpers-react
npm install @supabase/auth-ui-react @supabase/auth-ui-shared

# Для SSR/Node.js backend
npm install @supabase/ssr

# Обновить pg driver для Supabase
npm install pg

# Удалить openid-client (Replit Auth)
npm uninstall openid-client passport passport-local

# Обновить Drizzle для работы с Supabase Postgres
npm install drizzle-orm@latest drizzle-kit@latest
```

---

## ФАЗА 2: Миграция базы данных

### 2.1 Экспорт текущей схемы и данных

```bash
# Экспорт схемы из Neon
pg_dump "$DATABASE_URL" --schema-only > schema_backup.sql

# Экспорт данных
pg_dump "$DATABASE_URL" --data-only > data_backup.sql

# Полный backup
pg_dump "$DATABASE_URL" > full_backup.sql
```

### 2.2 Подготовка миграций для Supabase

**Файл:** `/migrations/supabase_initial.sql`

```sql
-- Включить необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ВАЖНО: НЕ создавать таблицу users, она будет в auth.users от Supabase
-- Вместо этого создадим profiles и синхронизируем с auth.users

-- 1. Таблица profiles (вместо users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_image_url TEXT,
  role TEXT DEFAULT 'leiter' CHECK (role IN ('admin', 'leiter')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger для автоматического создания profile при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, profile_image_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'profile_image_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Таблица firms (без изменений)
CREATE TABLE public.firms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  invoice_ninja_url TEXT,
  token TEXT,
  address TEXT,
  tax_id TEXT,
  logo_url TEXT,
  postmark_server_token TEXT,
  postmark_from_email TEXT,
  postmark_message_stream TEXT DEFAULT 'transactional',
  email_subject_template TEXT DEFAULT 'Счет №{{invoiceNumber}} от {{firmName}}',
  email_body_template TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Таблица user_firms (обновить FK на profiles)
CREATE TABLE public.user_firms (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, firm_id)
);

-- 4. Таблица clients
CREATE TABLE public.clients (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  ninja_client_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Таблица crews
CREATE TABLE public.crews (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unique_number TEXT,
  leader_name TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacation', 'equipment_issue', 'unavailable')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Таблица crew_members
CREATE TABLE public.crew_members (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  unique_number TEXT,
  phone TEXT,
  role TEXT DEFAULT 'worker' CHECK (role IN ('leader', 'worker', 'specialist')),
  member_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Таблица projects
CREATE TABLE public.projects (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
  leiter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'planning' CHECK (status IN (
    'planning', 'equipment_waiting', 'equipment_arrived',
    'work_scheduled', 'work_in_progress', 'work_completed',
    'invoiced', 'invoice_sent', 'paid'
  )),
  equipment_expected_date DATE,
  equipment_arrived_date DATE,
  work_start_date DATE,
  work_end_date DATE,
  crew_upload_token TEXT,
  crew_upload_token_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Таблица services
CREATE TABLE public.services (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  product_key TEXT,
  description TEXT,
  price NUMERIC(10, 2),
  quantity INTEGER DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Таблица invoices
CREATE TABLE public.invoices (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_id TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  total_amount NUMERIC(10, 2),
  is_paid BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Таблица file_storage (будет использовать Supabase Storage)
CREATE TABLE public.file_storage (
  id SERIAL PRIMARY KEY,
  file_id UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  original_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  category TEXT CHECK (category IN ('project_file', 'report', 'invoice', 'document', 'image', 'profile')),
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  storage_path TEXT -- Путь в Supabase Storage
);

-- 11. Таблица project_reports
CREATE TABLE public.project_reports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  review_document_url TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Таблица project_notes
CREATE TABLE public.project_notes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Таблица project_history
CREATE TABLE public.project_history (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT,
  crew_snapshot_id INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Таблица crew_history
CREATE TABLE public.crew_history (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('crew_created', 'member_added', 'member_removed')),
  member_id INTEGER,
  member_name TEXT,
  member_specialization TEXT,
  start_date DATE,
  end_date DATE,
  change_description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Таблица project_crew_snapshots
CREATE TABLE public.project_crew_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  snapshot_date TIMESTAMPTZ DEFAULT NOW(),
  crew_data JSONB,
  members_data JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 16. Таблица project_shares
CREATE TABLE public.project_shares (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, shared_with)
);

-- Legacy tables (можно не мигрировать, если не используются)
-- CREATE TABLE public.project_files ...
-- CREATE TABLE public.invoice_queue ...

-- Индексы для оптимизации
CREATE INDEX idx_projects_firm_id ON public.projects(firm_id);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_leiter_id ON public.projects(leiter_id);
CREATE INDEX idx_projects_crew_id ON public.projects(crew_id);
CREATE INDEX idx_clients_firm_id ON public.clients(firm_id);
CREATE INDEX idx_crews_firm_id ON public.crews(firm_id);
CREATE INDEX idx_services_project_id ON public.services(project_id);
CREATE INDEX idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX idx_file_storage_project_id ON public.file_storage(project_id);
CREATE INDEX idx_file_storage_file_id ON public.file_storage(file_id);
CREATE INDEX idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX idx_project_history_project_id ON public.project_history(project_id);
CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX idx_project_shares_shared_with ON public.project_shares(shared_with);

-- Row Level Security (RLS) политики

-- Включить RLS на всех таблицах
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Политики для profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Политики для firms (только для пользователей с доступом)
CREATE POLICY "Users can view firms they belong to" ON public.firms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = firms.id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Политики для projects
CREATE POLICY "Users can view projects from their firms" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = projects.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.project_shares
      WHERE shared_with = auth.uid() AND project_id = projects.id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ... (добавить аналогичные политики для остальных таблиц)
```

### 2.3 Применение миграций в Supabase

```bash
# Запустить миграцию в Supabase через dashboard SQL Editor
# Или через Supabase CLI:
supabase db push
```

### 2.4 Миграция данных

**Скрипт миграции:** `/scripts/migrate_data.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const { Pool } = pg;

// Старая БД (Neon)
const oldPool = new Pool({
  connectionString: process.env.OLD_DATABASE_URL
});

// Новая БД (Supabase)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Использовать service_role key
);

async function migrateUsers() {
  console.log('Migrating users...');
  const { rows: users } = await oldPool.query('SELECT * FROM users');

  for (const user of users) {
    // Создать пользователя в Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      email_confirm: true,
      user_metadata: {
        first_name: user.firstName,
        last_name: user.lastName,
        profile_image_url: user.profileImageUrl
      }
    });

    if (authError) {
      console.error(`Error creating user ${user.email}:`, authError);
      continue;
    }

    // Обновить profile (будет создан trigger'ом, но обновим role)
    await supabase
      .from('profiles')
      .update({ role: user.role })
      .eq('id', authUser.user.id);

    console.log(`Migrated user: ${user.email} (${user.id} -> ${authUser.user.id})`);
  }
}

async function migrateFirms() {
  console.log('Migrating firms...');
  const { rows: firms } = await oldPool.query('SELECT * FROM firms');

  const { data, error } = await supabase
    .from('firms')
    .insert(firms.map(f => ({
      id: f.id,
      name: f.name,
      invoice_ninja_url: f.invoiceNinjaUrl,
      token: f.token,
      address: f.address,
      tax_id: f.taxId,
      logo_url: f.logoUrl,
      postmark_server_token: f.postmarkServerToken,
      postmark_from_email: f.postmarkFromEmail,
      postmark_message_stream: f.postmarkMessageStream,
      email_subject_template: f.emailSubjectTemplate,
      email_body_template: f.emailBodyTemplate
    })));

  if (error) console.error('Error migrating firms:', error);
  else console.log(`Migrated ${firms.length} firms`);
}

// Аналогично для остальных таблиц...
async function migrateAll() {
  await migrateUsers();
  await migrateFirms();
  // await migrateClients();
  // await migrateCrews();
  // await migrateProjects();
  // и т.д.

  console.log('Migration complete!');
  process.exit(0);
}

migrateAll().catch(console.error);
```

---

## ФАЗА 3: Миграция авторизации

### 3.1 Удаление Replit Auth

**Удалить файлы:**
- `/server/replitAuth.ts` (191 строка)
- Убрать из `/server/middleware/auth.ts` ссылки на Replit Auth

### 3.2 Создание Supabase Auth middleware

**Файл:** `/server/middleware/supabaseAuth.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function authenticateSupabase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Получить полный профиль из БД
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(401).json({ error: 'User profile not found' });
  }

  req.user = profile;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function requireFirmAccess(firmIdParam: string = 'firmId') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const firmId = parseInt(req.params[firmIdParam]);

    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Admins have access to all firms
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user has access to this firm
    const { data, error } = await supabase
      .from('user_firms')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('firm_id', firmId)
      .single();

    if (error || !data) {
      return res.status(403).json({ error: 'Access to this firm denied' });
    }

    next();
  };
}
```

### 3.3 Обновление эндпоинтов авторизации

**Файл:** `/server/routes.ts` (обновить секцию auth)

```typescript
// Удалить старые endpoints:
// - GET /api/login
// - GET /api/callback
// - GET /api/logout
// - POST /api/auth/test-login

// Новые endpoints для Supabase Auth:

// Регистрация
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName
      }
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ user: data.user, session: data.session });
});

// Логин
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  res.json({ user: data.user, session: data.session });
});

// Логаут
app.post('/api/auth/logout', authenticateSupabase, async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.substring(7);

  if (!token) {
    return res.status(400).json({ error: 'No token provided' });
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ message: 'Logged out successfully' });
});

// Получить текущего пользователя
app.get('/api/auth/user', authenticateSupabase, (req, res) => {
  res.json({ user: req.user });
});

// Обновить профиль
app.patch('/api/auth/profile', authenticateSupabase, async (req, res) => {
  const { firstName, lastName, profileImageUrl } = req.body;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      first_name: firstName,
      last_name: lastName,
      profile_image_url: profileImageUrl
    })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

// Изменить пароль
app.patch('/api/auth/password', authenticateSupabase, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Сначала проверяем текущий пароль
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: req.user.email,
    password: currentPassword
  });

  if (signInError) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Обновляем пароль
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ message: 'Password updated successfully' });
});

// OAuth providers (опционально)
app.get('/api/auth/oauth/:provider', async (req, res) => {
  const provider = req.params.provider as 'google' | 'github' | 'gitlab';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.FRONTEND_URL}/auth/callback`
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ url: data.url });
});
```

### 3.4 Обновление фронтенда

**Файл:** `/client/src/lib/supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**Файл:** `/client/src/hooks/useAuth.tsx`

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Получить текущую сессию
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Подписаться на изменения auth состояния
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };
}
```

### 3.5 Обновить все защищенные маршруты

Заменить middleware:
```typescript
// Было:
app.get('/api/projects', isAuthenticated, requireAuth, async (req, res) => {

// Стало:
app.get('/api/projects', authenticateSupabase, async (req, res) => {
```

---

## ФАЗА 4: Миграция файлового хранилища

### 4.1 Создание buckets в Supabase Storage

```sql
-- В Supabase Dashboard -> Storage -> Create new bucket

-- Bucket: project-files
-- Public: false (приватный)
-- File size limit: 10MB
-- Allowed MIME types: image/*, application/pdf, application/msword, etc.
```

### 4.2 Обновление storage.ts для работы с Supabase Storage

**Файл:** `/server/storage.ts` (обновить методы для файлов)

```typescript
import { supabase } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseStorage {
  // ... existing methods

  async uploadFile(file: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
    category: string;
    projectId?: number;
    uploadedBy: string;
  }) {
    const fileId = uuidv4();
    const ext = file.originalName.split('.').pop();
    const fileName = `${fileId}.${ext}`;
    const storagePath = `${file.category}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, file.buffer, {
        contentType: file.mimeType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    // Save metadata to database
    const { data, error } = await supabase
      .from('file_storage')
      .insert({
        file_id: fileId,
        original_name: file.originalName,
        file_name: fileName,
        mime_type: file.mimeType,
        size: file.size,
        category: file.category,
        project_id: file.projectId,
        uploaded_by: file.uploadedBy,
        storage_path: storagePath
      })
      .select()
      .single();

    if (error) {
      // Rollback storage upload
      await supabase.storage.from('project-files').remove([storagePath]);
      throw new Error(`Failed to save file metadata: ${error.message}`);
    }

    return data;
  }

  async getFileUrl(fileId: string, expiresIn: number = 3600) {
    // Получить metadata
    const { data: fileData, error } = await supabase
      .from('file_storage')
      .select('storage_path')
      .eq('file_id', fileId)
      .single();

    if (error || !fileData) {
      throw new Error('File not found');
    }

    // Generate signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('project-files')
      .createSignedUrl(fileData.storage_path, expiresIn);

    if (urlError) {
      throw new Error(`Failed to generate URL: ${urlError.message}`);
    }

    return urlData.signedUrl;
  }

  async deleteFile(fileId: string, userId: string) {
    // Получить metadata
    const { data: fileData, error: fetchError } = await supabase
      .from('file_storage')
      .select('storage_path')
      .eq('file_id', fileId)
      .single();

    if (fetchError || !fileData) {
      throw new Error('File not found');
    }

    // Soft delete в БД
    const { error: updateError } = await supabase
      .from('file_storage')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('file_id', fileId);

    if (updateError) {
      throw new Error(`Failed to mark file as deleted: ${updateError.message}`);
    }

    // Удалить из storage
    const { error: storageError } = await supabase.storage
      .from('project-files')
      .remove([fileData.storage_path]);

    if (storageError) {
      console.error('Failed to delete from storage:', storageError);
      // Не выбрасываем ошибку, т.к. файл уже помечен как удаленный
    }

    return true;
  }
}
```

### 4.3 Миграция существующих файлов

**Скрипт:** `/scripts/migrate_files.js`

```javascript
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function migrateFiles() {
  // Получить все файлы из старой БД
  const { data: files } = await supabase
    .from('file_storage')
    .select('*')
    .is('storage_path', null); // Файлы без storage_path еще не мигрированы

  for (const file of files) {
    try {
      // Читаем файл с диска (если хранились локально)
      const filePath = path.join('/uploads', file.file_name);
      const fileBuffer = await fs.readFile(filePath);

      // Загружаем в Supabase Storage
      const storagePath = `${file.category}/${file.file_name}`;
      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(storagePath, fileBuffer, {
          contentType: file.mime_type
        });

      if (uploadError) {
        console.error(`Failed to upload ${file.file_name}:`, uploadError);
        continue;
      }

      // Обновляем metadata
      await supabase
        .from('file_storage')
        .update({ storage_path: storagePath })
        .eq('id', file.id);

      console.log(`Migrated: ${file.file_name}`);
    } catch (err) {
      console.error(`Error migrating ${file.file_name}:`, err);
    }
  }

  console.log('File migration complete!');
}

migrateFiles();
```

---

## ФАЗА 5: Рефакторинг кода

### 5.1 Обновление database connection

**Файл:** `/server/supabaseClient.ts` (новый)

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../shared/database.types'; // сгенерировать типы

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export const supabaseAnon = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
```

**Удалить:**
- `/server/db.ts` (Neon connection)

### 5.2 Обновление Drizzle config для Supabase

**Файл:** `/drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.SUPABASE_DB_URL! // Direct PostgreSQL connection string
  }
} satisfies Config;
```

### 5.3 Обновление environment variables

**Файл:** `.env.example`

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_KEY=eyJxxx...
SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Frontend
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# External services (без изменений)
INVOICE_NINJA_URL=
INVOICE_NINJA_API_KEY=
SENDGRID_API_KEY=

# App settings
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 5.4 Удаление Replit-specific кода

**Файлы для удаления:**
- `/.replit` - Replit deployment config
- `/server/replitAuth.ts` - Replit Auth
- Удалить из `/vite.config.ts`:
  ```typescript
  // Удалить:
  import { vitePluginCartographer } from '@replit/vite-plugin-cartographer';
  import { vitePluginRuntimeErrorModal } from '@replit/vite-plugin-runtime-error-modal';

  // Удалить из plugins:
  // vitePluginCartographer(),
  // vitePluginRuntimeErrorModal(),
  ```

**Обновить `/server/routes.ts`:**
- Удалить все проверки `REPLIT_DOMAINS`
- Использовать `process.env.FRONTEND_URL` напрямую

---

## ФАЗА 6: Тестирование

### 6.1 Unit тесты

Создать тесты для:
- Auth middleware
- Storage operations
- API endpoints

**Файл:** `/tests/auth.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { supabase } from '../server/supabaseClient';

describe('Supabase Auth', () => {
  let testUserId: string;

  it('should create a new user', async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'test@example.com',
      password: 'test123456',
      email_confirm: true
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    testUserId = data.user!.id;
  });

  it('should sign in with password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'test123456'
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
  });

  // Cleanup
  afterAll(async () => {
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });
});
```

### 6.2 Integration тесты

Тестировать полный flow:
1. Регистрация → Логин → Создание проекта → Загрузка файла → Логаут

### 6.3 Тестирование RLS политик

```sql
-- Тестировать от имени пользователя
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<user-id>","role":"authenticated"}';

-- Попытка чтения проектов другой фирмы (должна вернуть 0 строк)
SELECT * FROM projects WHERE firm_id = 999;
```

---

## ФАЗА 7: Деплой и переход

### 7.1 Подготовка production Supabase

1. Настроить production БД в Supabase
2. Применить все миграции
3. Настроить RLS политики
4. Создать storage buckets
5. Настроить email провайдера (для auth emails)
6. Настроить custom SMTP (опционально)

### 7.2 CI/CD настройка

**Файл:** `.github/workflows/deploy.yml`

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Build
        run: npm run build

      - name: Deploy to Railway/Render
        run: |
          # Deploy commands here
```

### 7.3 Миграция production данных

```bash
# 1. Создать финальный backup
pg_dump "$OLD_DATABASE_URL" > final_backup.sql

# 2. Режим read-only на старой БД (опционально)

# 3. Запустить скрипт миграции данных
node scripts/migrate_data.js

# 4. Запустить скрипт миграции файлов
node scripts/migrate_files.js

# 5. Проверить целостность данных

# 6. Переключить DNS на новый backend

# 7. Мониторинг ошибок 24/48 часов
```

### 7.4 Rollback план

В случае критических проблем:

```bash
# 1. Переключить DNS обратно на Replit
# 2. Восстановить старую БД из backup
pg_restore -d "$OLD_DATABASE_URL" final_backup.sql

# 3. Откатить изменения в коде
git revert <commit-hash>

# 4. Redeploy старой версии
```

---

## Чеклист миграции

### Подготовка
- [ ] Создан Supabase проект
- [ ] Установлены новые зависимости
- [ ] Удалены Replit зависимости
- [ ] Созданы миграции БД

### База данных
- [ ] Применены миграции схемы
- [ ] Мигрированы users → profiles
- [ ] Мигрированы все остальные таблицы
- [ ] Настроены RLS политики
- [ ] Созданы индексы
- [ ] Проверена целостность данных

### Авторизация
- [ ] Реализован Supabase Auth middleware
- [ ] Обновлены все auth endpoints
- [ ] Обновлен frontend (useAuth hook)
- [ ] Тестирование логина/регистрации
- [ ] Тестирование смены пароля
- [ ] Тестирование OAuth (если используется)

### Файлы
- [ ] Созданы storage buckets в Supabase
- [ ] Обновлены методы uploadFile/deleteFile
- [ ] Мигрированы существующие файлы
- [ ] Тестирование загрузки/скачивания
- [ ] Тестирование удаления

### Код
- [ ] Удален replitAuth.ts
- [ ] Обновлен db.ts → supabaseClient.ts
- [ ] Обновлены все middleware
- [ ] Обновлены все API routes
- [ ] Удалены Replit plugins из vite.config
- [ ] Обновлены environment variables

### Тестирование
- [ ] Unit тесты пройдены
- [ ] Integration тесты пройдены
- [ ] RLS политики протестированы
- [ ] Load testing (опционально)
- [ ] Security audit (опционально)

### Деплой
- [ ] Настроен production Supabase
- [ ] Настроен CI/CD
- [ ] Проведена миграция production данных
- [ ] DNS переключен на новый backend
- [ ] Мониторинг запущен
- [ ] Rollback план готов

---

## Оценка времени

| Фаза | Время (часов) |
|------|---------------|
| 1. Подготовка | 4-6 |
| 2. Миграция БД | 8-12 |
| 3. Миграция Auth | 12-16 |
| 4. Миграция Files | 6-8 |
| 5. Рефакторинг | 8-12 |
| 6. Тестирование | 12-16 |
| 7. Деплой | 4-8 |
| **ИТОГО** | **54-78 часов** |

---

## Риски и митигация

| Риск | Вероятность | Воздействие | Митигация |
|------|-------------|-------------|-----------|
| Потеря данных при миграции | Средняя | Критическое | Множественные backups, поэтапная миграция |
| Несовместимость UUID vs INT для user IDs | Высокая | Среднее | Маппинг таблица old_id → new_id |
| Downtime при переходе | Высокая | Среднее | Blue-green deployment |
| RLS политики блокируют легитимных users | Средняя | Среднее | Тщательное тестирование, логирование |
| Проблемы с file URLs после миграции | Средняя | Среднее | Сохранить старые URLs, redirect |

---

## Рекомендации

1. **Поэтапная миграция:** Сначала staging, потом production
2. **Параллельная работа:** Держать обе системы online первые 1-2 недели
3. **Мониторинг:** Настроить Sentry/LogRocket для отслеживания ошибок
4. **Backups:** Автоматические daily backups в Supabase
5. **Documentation:** Обновить README и документацию для новых разработчиков

---

## Ресурсы

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Drizzle ORM + Supabase](https://orm.drizzle.team/docs/get-started-postgresql#supabase)

---

**Следующие шаги:** После утверждения плана начать с Фазы 1 - создания Supabase проекта и установки зависимостей.
