-- Seed data for development environment

-- Создаем тестовую фирму
INSERT INTO public.firms (name, invoice_ninja_url, token, address)
VALUES ('Тест Фирма', 'https://example.com/api', 'test-token', 'Test Address 123')
ON CONFLICT DO NOTHING;

-- Примечание: Пользователи создаются через Supabase Auth API
-- После запуска supabase, зарегистрируйтесь через UI или используйте:
-- curl -X POST 'http://localhost:54321/auth/v1/signup' \
--   -H "apikey: YOUR_ANON_KEY" \
--   -H "Content-Type: application/json" \
--   -d '{"email":"admin@example.com","password":"password123"}'
