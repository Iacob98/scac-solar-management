-- Добавление недостающих колонок в существующие таблицы

-- ============================================================================
-- PROJECTS: добавить start_date, end_date и другие недостающие колонки
-- ============================================================================

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS team_number TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS invoice_url TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS needs_call_equipment_delay BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS needs_call_crew_delay BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS needs_call_date_change BOOLEAN DEFAULT FALSE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS installation_person_first_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS installation_person_last_name TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS installation_person_address TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS installation_person_phone TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS installation_person_unique_id TEXT;

-- ============================================================================
-- CREWS: добавить archived колонку
-- ============================================================================

ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- CREW_MEMBERS: добавить archived и address колонки
-- ============================================================================

ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS address TEXT;

-- ============================================================================
-- PROJECT_REPORTS: добавить created_at колонку
-- ============================================================================

ALTER TABLE public.project_reports ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- Обновить статусы проектов для поддержки send_invoice
-- ============================================================================

-- Убрать constraint если существует и создать новый
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (status IN (
  'planning', 'equipment_waiting', 'equipment_arrived',
  'work_scheduled', 'work_in_progress', 'work_completed',
  'invoiced', 'send_invoice', 'invoice_sent', 'paid'
));

COMMENT ON COLUMN public.projects.start_date IS 'Project start date';
COMMENT ON COLUMN public.projects.end_date IS 'Project end date';
COMMENT ON COLUMN public.crews.archived IS 'Whether the crew is archived';
COMMENT ON COLUMN public.crew_members.archived IS 'Whether the crew member is archived';
