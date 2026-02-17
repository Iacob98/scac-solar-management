-- Создание недостающих таблиц и включение RLS
-- notifications, reclamations, reclamation_history, invoice_queue

-- ============================================
-- 1. CREATE MISSING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.invoice_queue (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id),
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reclamations (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES public.projects(id),
  firm_id INTEGER NOT NULL REFERENCES public.firms(id),
  description TEXT NOT NULL,
  deadline DATE NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  original_crew_id INTEGER NOT NULL REFERENCES public.crews(id),
  current_crew_id INTEGER NOT NULL REFERENCES public.crews(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP DEFAULT now(),
  accepted_by INTEGER REFERENCES public.crew_members(id),
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  completed_notes TEXT
);

CREATE TABLE IF NOT EXISTS public.reclamation_history (
  id SERIAL PRIMARY KEY,
  reclamation_id INTEGER NOT NULL REFERENCES public.reclamations(id),
  action VARCHAR NOT NULL,
  action_by UUID REFERENCES public.profiles(id),
  action_by_member INTEGER REFERENCES public.crew_members(id),
  crew_id INTEGER REFERENCES public.crews(id),
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  project_id INTEGER REFERENCES public.projects(id),
  type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  source_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- 2. ENABLE RLS
-- ============================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reclamation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_queue ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS POLICIES
-- ============================================

-- Notifications — пользователь видит только свои уведомления
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Reclamations — доступ по firm_id
CREATE POLICY "Users can view reclamations from their firms" ON public.reclamations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = reclamations.firm_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage reclamations in their firms" ON public.reclamations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_firms
      WHERE user_id = auth.uid() AND firm_id = reclamations.firm_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Reclamation History — доступ через рекламацию → фирма
CREATE POLICY "Users can view reclamation history from their firms" ON public.reclamation_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reclamations
      JOIN public.user_firms ON reclamations.firm_id = user_firms.firm_id
      WHERE reclamation_history.reclamation_id = reclamations.id
        AND user_firms.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can manage reclamation history in their firms" ON public.reclamation_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.reclamations
      JOIN public.user_firms ON reclamations.firm_id = user_firms.firm_id
      WHERE reclamation_history.reclamation_id = reclamations.id
        AND user_firms.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Invoice Queue — только админы
CREATE POLICY "Admins can view invoice queue" ON public.invoice_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage invoice queue" ON public.invoice_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
