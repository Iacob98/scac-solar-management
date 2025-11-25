-- Включить необходимые расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ТАБЛИЦА PROFILES (вместо users, синхронизируется с auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
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
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'profile_image_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger для обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ТАБЛИЦА FIRMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.firms (
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
  email_body_template TEXT DEFAULT 'Уважаемый {{clientName}},

Направляем вам счет на оплату работ по установке солнечных панелей.

Сумма: {{totalAmount}}
Срок оплаты: {{dueDate}}

С уважением,
{{firmName}}',
  calendar_event_title TEXT DEFAULT 'Проект: {{projectId}} - Установка солнечных панелей',
  calendar_event_description TEXT DEFAULT 'Клиент: {{clientName}}
Адрес: {{address}}
Бригада: {{crewName}}
Дата начала: {{workStartDate}}
Дата окончания: {{workEndDate}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_firms_updated_at
  BEFORE UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ТАБЛИЦА USER_FIRMS (many-to-many)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_firms (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, firm_id)
);

-- ============================================================================
-- ТАБЛИЦА CLIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  ninja_client_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON public.clients(firm_id);

-- ============================================================================
-- ТАБЛИЦА CREWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crews (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unique_number TEXT,
  leader_name TEXT,
  phone TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'vacation', 'equipment_issue', 'unavailable')),
  gcal_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crews_firm_id ON public.crews(firm_id);
CREATE TRIGGER update_crews_updated_at
  BEFORE UPDATE ON public.crews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ТАБЛИЦА CREW_MEMBERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crew_members (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  unique_number TEXT,
  phone TEXT,
  role TEXT DEFAULT 'worker' CHECK (role IN ('leader', 'worker', 'specialist')),
  member_email TEXT,
  google_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_members_crew_id ON public.crew_members(crew_id);

-- ============================================================================
-- ТАБЛИЦА PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_firm_id ON public.projects(firm_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_leiter_id ON public.projects(leiter_id);
CREATE INDEX IF NOT EXISTS idx_projects_crew_id ON public.projects(crew_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ТАБЛИЦА SERVICES (позиции счета)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  product_key TEXT,
  description TEXT,
  price NUMERIC(10, 2),
  quantity INTEGER DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_project_id ON public.services(project_id);

-- ============================================================================
-- ТАБЛИЦА INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
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

CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);

-- ============================================================================
-- ТАБЛИЦА FILE_STORAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.file_storage (
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
  storage_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_file_storage_project_id ON public.file_storage(project_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_file_id ON public.file_storage(file_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_uploaded_by ON public.file_storage(uploaded_by);

-- ============================================================================
-- ТАБЛИЦА PROJECT_REPORTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_reports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  review_document_url TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_reports_project_id ON public.project_reports(project_id);

-- ============================================================================
-- ТАБЛИЦА PROJECT_NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_notes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent', 'critical')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_notes_user_id ON public.project_notes(user_id);

-- ============================================================================
-- ТАБЛИЦА PROJECT_HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_history (
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

CREATE INDEX IF NOT EXISTS idx_project_history_project_id ON public.project_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_history_user_id ON public.project_history(user_id);

-- ============================================================================
-- ТАБЛИЦА CREW_HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.crew_history (
  id SERIAL PRIMARY KEY,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('crew_created', 'member_added', 'member_removed')),
  member_id INTEGER,
  member_name TEXT,
  member_specialization TEXT,
  member_google_calendar_id TEXT,
  start_date DATE,
  end_date DATE,
  change_description TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_history_crew_id ON public.crew_history(crew_id);

-- ============================================================================
-- ТАБЛИЦА PROJECT_CREW_SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_crew_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  crew_id INTEGER REFERENCES public.crews(id) ON DELETE CASCADE,
  snapshot_date TIMESTAMPTZ DEFAULT NOW(),
  crew_data JSONB,
  members_data JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_crew_snapshots_project_id ON public.project_crew_snapshots(project_id);

-- ============================================================================
-- ТАБЛИЦА PROJECT_SHARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.project_shares (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  shared_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with ON public.project_shares(shared_with);

-- ============================================================================
-- ТАБЛИЦА GOOGLE_CALENDAR_SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_calendar_settings (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id TEXT,
  client_secret TEXT,
  redirect_uri TEXT,
  master_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_calendar_settings_firm_id ON public.google_calendar_settings(firm_id);

-- ============================================================================
-- ТАБЛИЦА GOOGLE_TOKENS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.google_tokens (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES public.firms(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expiry BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_google_tokens_firm_id ON public.google_tokens(firm_id);

CREATE TRIGGER update_google_tokens_updated_at
  BEFORE UPDATE ON public.google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ТАБЛИЦА CALENDAR_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE SET NULL,
  event_id TEXT,
  status TEXT,
  details JSONB
);

CREATE INDEX IF NOT EXISTS idx_calendar_logs_user_id ON public.calendar_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_logs_project_id ON public.calendar_logs(project_id);

-- ============================================================================
-- LEGACY TABLES (опционально, если нужны для совместимости)
-- ============================================================================

-- CREATE TABLE IF NOT EXISTS public.project_files ...
-- CREATE TABLE IF NOT EXISTS public.invoice_queue ...

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) ПОЛИТИКИ
-- ============================================================================

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
ALTER TABLE public.crew_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_crew_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_logs ENABLE ROW LEVEL SECURITY;

-- Политики для profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Политики для firms
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

CREATE POLICY "Admins can insert firms" ON public.firms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update firms" ON public.firms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Политики для user_firms
CREATE POLICY "Users can view own firm memberships" ON public.user_firms
  FOR SELECT USING (user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage firm memberships" ON public.user_firms
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Политики для clients
CREATE POLICY "Users can view clients from their firms" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = clients.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage clients in their firms" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = clients.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Политики для crews
CREATE POLICY "Users can view crews from their firms" ON public.crews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = crews.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage crews in their firms" ON public.crews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = crews.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Политики для crew_members
CREATE POLICY "Users can view crew members from their firms" ON public.crew_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crews
      JOIN public.user_firms ON crews.firm_id = user_firms.firm_id
      WHERE crew_members.crew_id = crews.id AND user_firms.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage crew members in their firms" ON public.crew_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.crews
      JOIN public.user_firms ON crews.firm_id = user_firms.firm_id
      WHERE crew_members.crew_id = crews.id AND user_firms.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Политики для projects
CREATE POLICY "Users can view projects from their firms or shared with them" ON public.projects
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

CREATE POLICY "Users can manage projects in their firms" ON public.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = projects.firm_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Аналогичные политики для остальных таблиц
-- (services, invoices, file_storage, project_reports, project_notes, etc.)
-- Все они должны проверять доступ через projects.firm_id

-- Политика для services
CREATE POLICY "Users can view services for accessible projects" ON public.services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.user_firms ON projects.firm_id = user_firms.firm_id
      WHERE services.project_id = projects.id AND user_firms.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can manage services for accessible projects" ON public.services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects
      JOIN public.user_firms ON projects.firm_id = user_firms.firm_id
      WHERE services.project_id = projects.id AND user_firms.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Прочие таблицы получают аналогичные политики...

COMMENT ON TABLE public.profiles IS 'User profiles synced with auth.users';
COMMENT ON TABLE public.firms IS 'Companies/Organizations';
COMMENT ON TABLE public.projects IS 'Solar panel installation projects';
