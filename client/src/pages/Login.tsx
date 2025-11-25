import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Mail, Lock, AlertCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleClearSession = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      toast({
        title: 'Сессия очищена',
        description: 'Старая сессия удалена. Можете войти заново.',
      });
      window.location.reload();
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setError(error.message || 'Неверный email или пароль');
        toast({
          title: 'Ошибка входа',
          description: error.message || 'Неверный email или пароль',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Вход выполнен',
          description: 'Добро пожаловать!',
        });
        // Используем window.location для полной перезагрузки и инициализации сессии
        window.location.href = '/';
      }
    } catch (err: any) {
      setError('Произошла ошибка при входе');
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при входе',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <LogIn className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Вход в систему
          </CardTitle>
          <CardDescription>
            Войдите в свой аккаунт для продолжения работы
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ваш@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Вход...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Войти
                </>
              )}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-sm text-gray-600">
                Нет аккаунта?{' '}
                <Link
                  to="/register"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Зарегистрироваться
                </Link>
              </p>

              {process.env.NODE_ENV === 'development' && (
                <p className="text-xs text-gray-500">
                  Режим разработки:{' '}
                  <Link
                    to="/test-login"
                    className="text-blue-600 hover:underline"
                  >
                    Тестовый вход
                  </Link>
                </p>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSession}
                className="text-gray-500 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Очистить сессию
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
