import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Mail, Phone, MapPin } from 'lucide-react';
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
  const { t } = useI18n();
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
      const response = await apiRequest('POST', '/api/clients', {
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

  const onSubmit = (data: z.infer<typeof clientSchema>) => {
    createClientMutation.mutate(data);
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
        <div className="p-6 text-center">
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Клиенты</h1>
            <p className="text-gray-600 mt-1">Синхронизированы с Invoice Ninja</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white">
                <Plus className="w-4 h-4 mr-2" />
                Добавить нового клиента
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
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

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {isLoading ? (
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
                  <TableHead>Название</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Адрес</TableHead>
                  <TableHead>Статус синхронизации</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium">{client.name}</div>
                    </TableCell>
                    <TableCell>
                      {client.email ? (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{client.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.phone ? (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{client.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.address ? (
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="truncate max-w-xs">{client.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.ninjaClientId ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-green-600">Синхронизирован</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="text-sm text-yellow-600">Только локально</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(client)}
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
