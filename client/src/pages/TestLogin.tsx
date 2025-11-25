import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, User, Mail, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TestLoginProps {
  onLoginSuccess: () => void;
}

export default function TestLogin({ onLoginSuccess }: TestLoginProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: testUsers = [], isLoading } = useQuery({
    queryKey: ['/api/auth/test-users'],
    queryFn: async () => {
      const response = await fetch('/api/auth/test-users');
      if (!response.ok) {
        throw new Error('Failed to fetch test users');
      }
      return response.json() as TestUser[];
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await apiRequest('/api/auth/test-login', 'POST', { email });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: 'Вход выполнен',
        description: 'Добро пожаловать в систему!',
      });
      // Небольшая задержка для обновления кэша
      setTimeout(() => {
        onLoginSuccess();
      }, 500);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка входа',
        description: error.message || 'Не удалось войти в систему',
        variant: 'destructive',
      });
    },
  });

  const handleLogin = (email: string) => {
    loginMutation.mutate(email);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 mb-2">
            Тестовая авторизация
          </CardTitle>
          <p className="text-gray-600">
            Выберите пользователя для входа в систему разработки
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2 text-amber-800">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Режим разработки</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              Это временная система входа для тестирования функций совместного доступа
            </p>
          </div>

          <div className="grid gap-3">
            {testUsers.map((user) => (
              <Card 
                key={user.id} 
                className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
                onClick={() => handleLogin(user.email)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-full">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{user.name}</h3>
                        <div className="flex items-center space-x-1 text-sm text-gray-500">
                          <Mail className="h-3 w-3" />
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant={user.role === 'admin' ? 'default' : 'secondary'} 
                        className="text-xs"
                      >
                        {user.role === 'admin' ? 'Администратор' : 'Лейтер'}
                      </Badge>
                      <Button
                        size="sm"
                        disabled={loginMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLogin(user.id);
                        }}
                      >
                        {loginMutation.isPending ? 'Вход...' : 'Войти'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>
              Для использования в продакшене войдите через{' '}
              <a href="/api/login" className="text-blue-600 hover:underline">
                Replit Auth
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}