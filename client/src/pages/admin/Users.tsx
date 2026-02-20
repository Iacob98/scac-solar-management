import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import type { User, Firm } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, User as UserIcon, Shield, Mail, Calendar, Building, Users as UsersIcon, Key } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email('Неверный формат email'),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  role: z.enum(['admin', 'leiter']),
  firmIds: z.array(z.string()).optional(),
  password: z.string().optional(),
}).refine((data) => {
  // For new leiter users, password is required (min 6 chars)
  // This is handled dynamically in the form based on editingUser state
  return true;
}, {
  message: 'Пароль обязателен для руководителя проекта (минимум 6 символов)',
  path: ['password'],
});

export default function Users() {
  const { toast } = useToast();
  const { user, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'leiter',
      firmIds: [],
      password: '',
    },
  });

  // Hooks must be called unconditionally - move queries before early returns
  const { data: users = [], isLoading: loadingUsers } = useQuery<(User & { firms?: Firm[] })[]>({
    queryKey: ['/api/users-with-firms'],
    enabled: !loading && profile?.role === 'admin',
  });

  const { data: firms = [], isLoading: loadingFirms } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
    enabled: !loading && profile?.role === 'admin',
  });

  // Показываем загрузку пока проверяем аутентификацию
  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Check if user is admin AFTER loading is complete
  if (profile?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 text-center">
          <div className="relative mx-auto w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400 to-orange-600 rounded-full opacity-20"></div>
            <div className="absolute inset-2 bg-gradient-to-br from-red-500 to-orange-700 rounded-full opacity-40"></div>
            <div className="absolute inset-4 bg-gradient-to-br from-red-600 to-orange-800 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">
            Доступ запрещен
          </h1>
          <p className="text-gray-600">
            У вас нет прав для просмотра этой страницы.
          </p>
        </div>
      </MainLayout>
    );
  }

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const response = await apiRequest('/api/users', 'POST', data);

      try {
        return await response.json();
      } catch (parseError) {
        console.error('Failed to parse server response:', parseError);
        throw new Error('Сервер вернул неверный формат данных. Пожалуйста, попробуйте снова.');
      }
    },
    onSuccess: async () => {
      toast({
        title: 'Успешно',
        description: 'Пользователь успешно создан',
      });

      try {
        await queryClient.invalidateQueries({ queryKey: ['/api/users-with-firms'] });
      } catch (refetchError) {
        console.error('Failed to refresh user list:', refetchError);
      }

      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      console.error('User creation failed:', error);
      toast({
        title: 'Ошибка создания пользователя',
        description: error.message || 'Не удалось создать пользователя. Пожалуйста, попробуйте снова.',
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: z.infer<typeof userSchema> }) => {
      const response = await apiRequest(`/api/users/${userId}`, 'PATCH', data);

      try {
        return await response.json();
      } catch (parseError) {
        console.error('Failed to parse server response:', parseError);
        throw new Error('Сервер вернул неверный формат данных. Пожалуйста, попробуйте снова.');
      }
    },
    onSuccess: async () => {
      toast({
        title: 'Успешно',
        description: 'Пользователь успешно обновлен',
      });

      try {
        await queryClient.invalidateQueries({ queryKey: ['/api/users-with-firms'] });
      } catch (refetchError) {
        console.error('Failed to refresh user list:', refetchError);
      }

      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: (error: Error) => {
      console.error('User update failed:', error);
      toast({
        title: 'Ошибка обновления пользователя',
        description: error.message || 'Не удалось обновить пользователя. Пожалуйста, попробуйте снова.',
        variant: 'destructive',
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const response = await apiRequest(`/api/users/${userId}/reset-password`, 'POST', { newPassword });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Пароль успешно сброшен',
      });
      setResetPasswordUser(null);
      setNewPassword('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сбросить пароль',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof userSchema>) => {
    // Validate password for new leiter users
    if (!editingUser && data.role === 'leiter') {
      if (!data.password || data.password.length < 6) {
        toast({
          title: 'Ошибка',
          description: 'Пароль обязателен для руководителя проекта (минимум 6 символов)',
          variant: 'destructive',
        });
        return;
      }
    }

    if (editingUser) {
      updateUserMutation.mutate({ userId: editingUser.id, data });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    // Extract firm IDs from the firms array and convert to strings
    const firmIds = user.firms?.map((firm: Firm) => String(firm.id)) || [];
    form.reset({
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'leiter',
      firmIds: firmIds,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    form.reset();
  };

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge variant="destructive">
        <Shield className="w-3 h-3 mr-1" />
        Администратор
      </Badge>
    ) : (
      <Badge variant="secondary">
        <UserIcon className="w-3 h-3 mr-1" />
        Руководитель проекта
      </Badge>
    );
  };

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <UsersIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Управление пользователями</h1>
            </div>
            <p className="text-gray-600 text-sm sm:text-base">Управляйте пользователями и их правами доступа</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                <span className="sm:inline">Добавить пользователя</span>
                <span className="sm:hidden">Добавить</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Редактировать пользователя' : 'Добавить нового пользователя'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      {...form.register('firstName')}
                      placeholder="Мария"
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      {...form.register('lastName')}
                      placeholder="Иванова"
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="maria.ivanova@example.com"
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="role">Роль</Label>
                  <Select
                    value={form.watch('role')}
                    onValueChange={(value) => form.setValue('role', value as 'admin' | 'leiter')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Администратор</SelectItem>
                      <SelectItem value="leiter">Руководитель проекта</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.formState.errors.role && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.role.message}
                    </p>
                  )}
                </div>

                {/* Password field - only for new leiter users */}
                {!editingUser && form.watch('role') === 'leiter' && (
                  <div>
                    <Label htmlFor="password">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      {...form.register('password')}
                      placeholder="Минимум 6 символов"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Пароль для входа в систему (минимум 6 символов)
                    </p>
                    {form.formState.errors.password && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                )}

                {form.watch('role') === 'leiter' && (
                  <div>
                    <Label>Назначенные фирмы</Label>
                    <div className="space-y-2 mt-2">
                      {firms.map((firm) => {
                        const firmIdStr = String(firm.id);
                        return (
                          <div key={firm.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`firm-${firm.id}`}
                              value={firmIdStr}
                              checked={form.watch('firmIds')?.includes(firmIdStr)}
                              onChange={(e) => {
                                const currentIds = form.watch('firmIds') || [];
                                if (e.target.checked) {
                                  form.setValue('firmIds', [...currentIds, firmIdStr]);
                                } else {
                                  form.setValue('firmIds', currentIds.filter(id => id !== firmIdStr));
                                }
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`firm-${firm.id}`} className="text-sm font-medium">
                              {firm.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    className="flex-1"
                  >
                    {(createUserMutation.isPending || updateUserMutation.isPending) ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* User Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Всего пользователей</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">
                {users.length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Администраторы</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">
                {users.filter((u: any) => u.role === 'admin').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Руководители проектов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-gray-900">
                {users.filter((u: any) => u.role === 'leiter').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Content */}
        {loadingUsers ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <div className="relative mx-auto w-24 h-24 mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full opacity-20"></div>
                  <div className="absolute inset-2 bg-gradient-to-br from-blue-500 to-purple-700 rounded-full opacity-40"></div>
                  <div className="absolute inset-4 bg-gradient-to-br from-blue-600 to-purple-800 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Пользователи не найдены
                </h3>
                <p className="text-gray-600 mb-6">
                  Добавьте первого пользователя в систему для начала работы
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Добавить пользователя
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isMobile ? (
          <div className="space-y-4">
            {users.map((user: any) => (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.firstName || ''} ${user.lastName || ''}`)}&background=1976d2&color=fff`}
                        alt={`${user.firstName || ''} ${user.lastName || ''}`}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {user.firstName || 'N/A'} {user.lastName || 'N/A'}
                        </h3>
                        <p className="text-sm text-gray-500">ID: {user.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {user.role === 'leiter' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetPasswordUser(user)}
                          title="Сбросить пароль"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700 truncate">{user.email}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Роль:</span>
                      {getRoleBadge(user.role)}
                    </div>
                    
                    <div className="flex items-start justify-between">
                      <span className="text-sm text-gray-600">Фирмы:</span>
                      <div className="flex flex-col items-end space-y-1">
                        {user.role === 'admin' ? (
                          <Badge variant="default">Все фирмы</Badge>
                        ) : (
                          <>
                            <Badge variant={user.firms?.length ? "secondary" : "outline"}>
                              {user.firms?.length || 0} {user.firms?.length === 1 ? 'фирма' : 'фирм'}
                            </Badge>
                            {user.firms && user.firms.length > 0 && (
                              <div className="text-xs text-gray-500 text-right max-w-[200px]">
                                {user.firms.map((firm: Firm) => firm.name).join(', ')}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Назначенные фирмы</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <img
                          src={user.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${user.firstName || ''} ${user.lastName || ''}`)}&background=1976d2&color=fff`}
                          alt={`${user.firstName || ''} ${user.lastName || ''}`}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium">{user.firstName || 'N/A'} {user.lastName || 'N/A'}</p>
                          <p className="text-sm text-gray-500">ID: {user.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building className="w-4 h-4 text-gray-400" />
                        <div className="flex flex-col space-y-1">
                          {user.role === 'admin' ? (
                            <Badge variant="default">Все фирмы</Badge>
                          ) : (
                            <>
                              <Badge variant={user.firms?.length ? "secondary" : "outline"}>
                                {user.firms?.length || 0} {user.firms?.length === 1 ? 'фирма' : 'фирм'}
                              </Badge>
                              {user.firms && user.firms.length > 0 && (
                                <div className="text-xs text-gray-500 max-w-xs">
                                  {user.firms.map((firm: Firm) => firm.name).join(', ')}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">
                          {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(user)}
                          title="Редактировать"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {user.role === 'leiter' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResetPasswordUser(user)}
                            title="Сбросить пароль"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Reset Password Dialog */}
        <Dialog open={!!resetPasswordUser} onOpenChange={() => { setResetPasswordUser(null); setNewPassword(''); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Сброс пароля</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Установить новый пароль для: <strong>{resetPasswordUser?.firstName} {resetPasswordUser?.lastName}</strong>
              </p>
              <div>
                <Label htmlFor="newPassword">Новый пароль</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => resetPasswordMutation.mutate({
                    userId: resetPasswordUser.id,
                    newPassword
                  })}
                  disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
                <Button variant="outline" onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}>
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
