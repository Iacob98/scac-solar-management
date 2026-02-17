-- ============================================================================
-- Синхронизация БД с Drizzle-схемой: добавление недостающих колонок и таблиц
-- ============================================================================

-- ============================================================================
-- 1. PROFILES: добавить crew_member_id и обновить role constraint
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS crew_member_id INTEGER;

-- Обновить CHECK constraint для role: добавить 'worker'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'leiter', 'worker'));

-- ============================================================================
-- 2. CREW_MEMBERS: добавить pin, pin_created_at, auth_user_id
-- ============================================================================

ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS pin VARCHAR(6);
ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS pin_created_at TIMESTAMPTZ;
ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- ============================================================================
-- 3. CREW_HISTORY: переименовать timestamp → created_at, добавить created_by
-- ============================================================================

-- Drizzle ожидает колонку created_at, а в БД она называется timestamp
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_history' AND column_name = 'timestamp' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'crew_history' AND column_name = 'created_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.crew_history RENAME COLUMN "timestamp" TO created_at;
  END IF;
END $$;

ALTER TABLE public.crew_history ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- ============================================================================
-- 4. PROJECT_HISTORY: переименовать timestamp → created_at
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_history' AND column_name = 'timestamp' AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_history' AND column_name = 'created_at' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.project_history RENAME COLUMN "timestamp" TO created_at;
  END IF;
END $$;

-- ============================================================================
-- 5. PROJECTS: добавить reclamation в status constraint
-- ============================================================================

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check CHECK (status IN (
  'planning', 'equipment_waiting', 'equipment_arrived',
  'work_scheduled', 'work_in_progress', 'work_completed',
  'reclamation', 'invoiced', 'send_invoice', 'invoice_sent', 'paid'
));

-- ============================================================================
-- 6. RECLAMATIONS: создать таблицу
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reclamations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  firm_id INTEGER NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  deadline DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled'
  )),
  original_crew_id INTEGER NOT NULL REFERENCES public.crews(id),
  current_crew_id INTEGER NOT NULL REFERENCES public.crews(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reclamations_project_id ON public.reclamations(project_id);
CREATE INDEX IF NOT EXISTS idx_reclamations_firm_id ON public.reclamations(firm_id);

-- ============================================================================
-- 7. RECLAMATION_HISTORY: создать таблицу
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reclamation_history (
  id SERIAL PRIMARY KEY,
  reclamation_id INTEGER NOT NULL REFERENCES public.reclamations(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'assigned', 'accepted', 'rejected', 'reassigned', 'completed', 'cancelled'
  )),
  action_by UUID REFERENCES public.profiles(id),
  action_by_member INTEGER REFERENCES public.crew_members(id),
  crew_id INTEGER REFERENCES public.crews(id),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reclamation_history_reclamation_id ON public.reclamation_history(reclamation_id);

-- ============================================================================
-- 8. NOTIFICATIONS: создать таблицу
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'file_added', 'note_added', 'status_change', 'report_added', 'reclamation_created'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  source_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications(project_id);

-- ============================================================================
-- 9. RLS для новых таблиц
-- ============================================================================

ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Reclamations: доступ через firm_id
CREATE POLICY "Users can view reclamations from their firms" ON public.reclamations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_firms WHERE user_id = auth.uid() AND firm_id = reclamations.firm_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can manage reclamations in their firms" ON public.reclamations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_firms WHERE user_id = auth.uid() AND firm_id = reclamations.firm_id)
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Reclamation history: доступ через reclamation → firm_id
CREATE POLICY "Users can view reclamation history" ON public.reclamation_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reclamations r
      JOIN public.user_firms uf ON r.firm_id = uf.firm_id
      WHERE r.id = reclamation_history.reclamation_id AND uf.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can manage reclamation history" ON public.reclamation_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.reclamations r
      JOIN public.user_firms uf ON r.firm_id = uf.firm_id
      WHERE r.id = reclamation_history.reclamation_id AND uf.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notifications: пользователь видит только свои
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

-- Service role может создавать уведомления для любого пользователя
CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);
