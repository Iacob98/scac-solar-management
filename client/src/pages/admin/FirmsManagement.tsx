import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Building, ExternalLink, Edit, Users, UserPlus, UserMinus } from 'lucide-react';
import type { Firm, User } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';

// Schema for creating a new firm
const createFirmSchema = z.object({
  name: z.string().min(1, 'Название фирмы обязательно'),
  invoiceNinjaUrl: z.string().url('Введите корректный URL'),
  token: z.string().min(1, 'API ключ обязателен'),
  address: z.string().optional(),
  taxId: z.string().optional(),
  logoUrl: z.string().url('Введите корректный URL логотипа').optional().or(z.literal('')),
});

type CreateFirmInput = z.infer<typeof createFirmSchema>;

export default function FirmsManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isUsersDialogOpen, setIsUsersDialogOpen] = useState(false);
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);

  const { data: firms = [], isLoading } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
  });

  const { data: usersWithFirms = [] } = useQuery<(User & { firms: Firm[] })[]>({
    queryKey: ['/api/users-with-firms'],
    enabled: isUsersDialogOpen,
  });

  const { data: firmUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/firms', selectedFirm?.id, 'users'],
    queryFn: async () => {
      if (!selectedFirm?.id) return [];
      const response = await apiRequest(`/api/firms/${selectedFirm.id}/users`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirm?.id && isUsersDialogOpen,
  });

  const form = useForm<CreateFirmInput>({
    resolver: zodResolver(createFirmSchema),
    defaultValues: {
      name: '',
      invoiceNinjaUrl: '',
      token: '',
      address: '',
      taxId: '',
      logoUrl: '',
    },
  });

  const createFirmMutation = useMutation({
    mutationFn: (data: CreateFirmInput) => apiRequest('/api/firms', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firms'] });
      toast({ title: 'Фирма создана успешно' });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать фирму',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateFirmInput) => {
    createFirmMutation.mutate(data);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    form.reset();
  };

  const testConnection = async () => {
    const invoiceNinjaUrl = form.getValues('invoiceNinjaUrl');
    const token = form.getValues('token');

    if (!invoiceNinjaUrl || !token) {
      toast({
        title: 'Ошибка',
        description: 'Введите URL и API ключ перед тестированием',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingConnection(true);
    
    try {
      const response = await apiRequest('/api/firms/test-connection', 'POST', {
        invoiceNinjaUrl,
        token,
      });
      
      const data = await response.json();
      
      if (data.success && data.companyInfo) {
        // Автоматически заполняем форму
        form.setValue('name', data.companyInfo.name);
        form.setValue('address', data.companyInfo.address);
        form.setValue('taxId', data.companyInfo.taxId);
        if (data.companyInfo.logoUrl) {
          form.setValue('logoUrl', data.companyInfo.logoUrl);
        }
        
        toast({
          title: 'Подключение успешно!',
          description: 'Данные компании загружены автоматически',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка подключения',
        description: error.message || 'Не удалось подключиться к Invoice Ninja',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const assignUserMutation = useMutation({
    mutationFn: ({ firmId, userId }: { firmId: string; userId: string }) => 
      apiRequest(`/api/firms/${firmId}/users/${userId}`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firms', selectedFirm?.id, 'users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users-with-firms'] });
      toast({
        title: 'Успешно',
        description: 'Пользователь добавлен в фирму',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить пользователя',
        variant: 'destructive',
      });
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: ({ firmId, userId }: { firmId: string; userId: string }) => 
      apiRequest(`/api/firms/${firmId}/users/${userId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firms', selectedFirm?.id, 'users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users-with-firms'] });
      toast({
        title: 'Успешно',
        description: 'Пользователь удален из фирмы',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить пользователя',
        variant: 'destructive',
      });
    },
  });

  const handleManageUsers = (firm: Firm) => {
    setSelectedFirm(firm);
    setIsUsersDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Управление фирмами</h1>
            <p className="text-gray-600">Добавление и управление фирмами в системе</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Добавить фирму
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Добавить новую фирму</DialogTitle>
              <DialogDescription>
                Создайте новую фирму в системе. Укажите название, данные Invoice Ninja и другую информацию.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название фирмы *</FormLabel>
                      <FormControl>
                        <Input placeholder="Название фирмы" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="invoiceNinjaUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Invoice Ninja *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://your-invoice-ninja.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API ключ Invoice Ninja *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="API ключ для доступа к Invoice Ninja" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-center py-4">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={testConnection}
                    disabled={isTestingConnection}
                    className="w-full"
                  >
                    {isTestingConnection ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Тестирование подключения...
                      </>
                    ) : (
                      <>
                        <Building className="h-4 w-4 mr-2" />
                        Тест подключения и загрузка данных
                      </>
                    )}
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Остальные поля будут заполнены автоматически после успешного подключения
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Адрес фирмы" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Налоговый номер</FormLabel>
                        <FormControl>
                          <Input placeholder="DE123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL логотипа</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/logo.png" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCloseDialog}
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createFirmMutation.isPending}
                  >
                    {createFirmMutation.isPending ? 'Создание...' : 'Создать фирму'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>

        <div className="grid gap-6">
        {firms.map((firm) => (
          <Card key={firm.id} className="hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  {firm.logoUrl ? (
                    <img 
                      src={firm.logoUrl} 
                      alt={`${firm.name} logo`}
                      className="w-14 h-14 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center border border-blue-200">
                      <Building className="h-7 w-7 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-xl text-gray-900">{firm.name}</CardTitle>
                    <CardDescription className="text-gray-600 mt-1">
                      {firm.taxId ? (
                        <span>Налоговый номер: {firm.taxId}</span>
                      ) : (
                        <span>Налоговый номер не указан</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  Активна
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-1">Invoice Ninja URL</h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{firm.invoiceNinjaUrl}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(firm.invoiceNinjaUrl, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-1">API ключ</h4>
                  <span className="text-sm font-mono">
                    {firm.token.substring(0, 8)}...{firm.token.substring(firm.token.length - 4)}
                  </span>
                </div>

                {firm.address && (
                  <div className="md:col-span-2">
                    <h4 className="font-medium text-sm text-gray-500 mb-1">Адрес</h4>
                    <p className="text-sm">{firm.address}</p>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Создана: {new Date(firm.createdAt).toLocaleDateString('ru-RU')}
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleManageUsers(firm)}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Управление пользователями
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {firms.length === 0 && (
          <div className="text-center py-12">
            <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Фирмы не найдены</h3>
            <p className="text-gray-500 mb-4">Добавьте первую фирму в систему</p>
          </div>
        )}
        </div>

        {/* Users Management Dialog */}
        <Dialog open={isUsersDialogOpen} onOpenChange={setIsUsersDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Управление пользователями - {selectedFirm?.name}</DialogTitle>
              <DialogDescription>
                Распределите пользователей по данной фирме. Только администраторы могут управлять доступом.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Current firm users */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Пользователи фирмы ({firmUsers.length})
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {firmUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Нет пользователей в этой фирме</p>
                    </div>
                  ) : (
                    firmUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {user.profileImageUrl ? (
                            <img 
                              src={user.profileImageUrl} 
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-medium">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'Администратор' : 'Руководитель проекта'}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeUserMutation.mutate({ 
                            firmId: selectedFirm!.id, 
                            userId: user.id 
                          })}
                          disabled={removeUserMutation.isPending}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Available users to add */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Доступные пользователи
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {usersWithFirms
                    .filter(user => !firmUsers.some(fu => fu.id === user.id))
                    .map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {user.profileImageUrl ? (
                            <img 
                              src={user.profileImageUrl} 
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                              <span className="text-gray-600 font-medium">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <div className="flex items-center space-x-2">
                              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                {user.role === 'admin' ? 'Администратор' : 'Руководитель проекта'}
                              </Badge>
                              {user.firms.length > 0 && (
                                <Badge variant="outline">
                                  {user.firms.length} фирм{user.firms.length === 1 ? 'а' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => assignUserMutation.mutate({ 
                            firmId: selectedFirm!.id, 
                            userId: user.id 
                          })}
                          disabled={assignUserMutation.isPending}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  
                  {usersWithFirms.filter(user => !firmUsers.some(fu => fu.id === user.id)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <UserPlus className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Все пользователи уже добавлены в эту фирму</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}