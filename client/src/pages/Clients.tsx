import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Client } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Mail, Phone, MapPin, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const clientSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  email: z.string().email('Неверный адрес электронной почты').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export default function Clients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const form = useForm<z.infer<typeof clientSchema>>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['/api/clients', selectedFirmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/clients?firmId=${selectedFirmId}`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const createClientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientSchema>) => {
      const response = await apiRequest('/api/clients', 'POST', {
        ...data,
        firmId: selectedFirmId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успех',
        description: 'Клиент успешно создан и синхронизирован с Invoice Ninja',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Ошибка при создании клиента',
        variant: 'destructive',
      });
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientSchema>) => {
      const response = await apiRequest(`/api/clients/${editingClient.id}`, 'PATCH', {
        ...data,
        firmId: selectedFirmId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успех',
        description: 'Клиент успешно обновлен',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      closeDialog();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Ошибка при обновлении клиента',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof clientSchema>) => {
    if (editingClient) {
      updateClientMutation.mutate(data);
    } else {
      createClientMutation.mutate(data);
    }
  };

  const openEditDialog = (client: any) => {
    setEditingClient(client);
    form.reset({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
    form.reset();
  };

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Клиенты
          </h1>
          <p className="text-gray-600">
            Пожалуйста, выберите фирму в заголовке для управления клиентами.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Клиенты</h1>
            <p className="text-gray-600 mt-1">Синхронизированы с Invoice Ninja</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Добавить нового клиента</span>
                <span className="sm:hidden">Добавить клиента</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 sm:mx-0">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Редактировать клиента' : 'Добавить нового клиента'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="Название компании или полное имя"
                  />
                  {form.formState.errors.name && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="клиент@пример.de"
                  />
                  {form.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    {...form.register('phone')}
                    placeholder="+49 123 456789"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Адрес</Label>
                  <Textarea
                    id="address"
                    {...form.register('address')}
                    placeholder="Улица, город, почтовый индекс"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={createClientMutation.isPending}
                    className="flex-1"
                  >
                    {createClientMutation.isPending ? 'Сохранение...' : 'Сохранить'}
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

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Нет клиентов
              </h3>
              <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                Добавьте первого клиента для начала работы с проектами
              </p>
              <div className="flex items-center justify-center text-sm text-blue-600">
                <Plus className="h-4 w-4 mr-1" />
                Используйте кнопку выше для добавления клиента
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <Card key={client.id} className="hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-600" />
                      {client.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {client.ninjaClientId ? (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-green-600 hidden sm:inline">Синхронизирован</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-xs text-yellow-600 hidden sm:inline">Локально</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(client)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {client.email ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span>Email не указан</span>
                    </div>
                  )}
                  
                  {client.phone ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>Телефон не указан</span>
                    </div>
                  )}
                  
                  {client.address ? (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{client.address}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>Адрес не указан</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
