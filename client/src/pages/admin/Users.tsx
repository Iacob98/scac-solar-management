import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
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
import { Plus, Edit, User as UserIcon, Shield, Mail, Calendar, Building } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().email('Неверный формат email'),
  firstName: z.string().min(1, 'Имя обязательно'),
  lastName: z.string().min(1, 'Фамилия обязательна'),
  role: z.enum(['admin', 'leiter']),
  firmIds: z.array(z.string()).optional(),
});

export default function Users() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'leiter',
      firmIds: [],
    },
  });

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Доступ запрещен
          </h1>
          <p className="text-gray-600">
            У вас нет прав для просмотра этой страницы.
          </p>
        </div>
      </MainLayout>
    );
  }

  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: firms = [], isLoading: loadingFirms } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userSchema>) => {
      const response = await apiRequest('POST', '/api/users', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Пользователь успешно создан',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof userSchema>) => {
    createUserMutation.mutate(data);
  };

  const openEditDialog = (user: any) => {
    setEditingUser(user);
    form.reset({
      email: user.email || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      role: user.role || 'leiter',
      firmIds: user.firmIds || [],
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Управление пользователями</h1>
            <p className="text-gray-600 mt-1">Управляйте пользователями и их правами доступа</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white">
                <Plus className="w-4 h-4 mr-2" />
                Добавить пользователя
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? 'Редактировать пользователя' : 'Добавить нового пользователя'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
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

                {form.watch('role') === 'leiter' && (
                  <div>
                    <Label>Назначенные фирмы</Label>
                    <div className="space-y-2 mt-2">
                      {firms.map((firm) => (
                        <div key={firm.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`firm-${firm.id}`}
                            value={firm.id}
                            checked={form.watch('firmIds')?.includes(firm.id)}
                            onChange={(e) => {
                              const currentIds = form.watch('firmIds') || [];
                              if (e.target.checked) {
                                form.setValue('firmIds', [...currentIds, firm.id]);
                              } else {
                                form.setValue('firmIds', currentIds.filter(id => id !== firm.id));
                              }
                            }}
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`firm-${firm.id}`} className="text-sm font-medium">
                            {firm.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={createUserMutation.isPending}
                    className="flex-1"
                  >
                    {createUserMutation.isPending ? 'Сохранение...' : 'Сохранить'}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loadingUsers ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (
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
                        <span className="text-sm">
                          {user.role === 'admin' ? 'Все фирмы' : `${user.firmIds?.length || 0} фирм`}
                        </span>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
