-- ============================================================================
-- Восстановление trigger handle_new_user для автоматического создания profiles
-- Проблема: при пересоздании таблиц (drizzle-kit push) trigger мог быть удалён
-- ============================================================================

-- 1. Пересоздаём функцию handle_new_user с поддержкой role='worker'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, profile_image_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'profile_image_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'leiter')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Пересоздаём trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Создаём профили для существующих auth.users у которых нет записи в profiles
INSERT INTO public.profiles (id, email, first_name, last_name, profile_image_url, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  au.raw_user_meta_data->>'profile_image_url',
  COALESCE(au.raw_user_meta_data->>'role', 'leiter')
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
