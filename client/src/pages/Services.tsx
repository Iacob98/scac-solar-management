import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Package, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertServiceSchema, type Service } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const serviceFormSchema = insertServiceSchema.extend({
  price: z.string().min(1, "Цена обязательна"),
  quantity: z.string().min(1, "Количество обязательно"),
});

interface ServicesPageProps {
  selectedFirm: string;
  projectId?: number;
}

export default function ServicesPage({ selectedFirm, projectId }: ServicesPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['/api/services', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/services?projectId=${projectId}`, 'GET');
      return await response.json();
    },
    enabled: !!projectId,
    refetchInterval: 10000, // Автообновление каждые 10 секунд
  });

  const { data: products = [] } = useQuery({
    queryKey: ['/api/catalog/products'],
    queryFn: async () => {
      const response = await apiRequest('/api/catalog/products', 'GET');
      return await response.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      projectId: projectId || 0,
      productKey: '',
      description: '',
      price: '',
      quantity: '1',
      isCustom: false,
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/services', 'POST', {
      ...data,
      projectId,
      price: data.price,
      quantity: data.quantity,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', projectId] });
      toast({ title: 'Услуга добавлена успешно' });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить услугу',
        variant: 'destructive'
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/services/${editingService?.id}`, 'PATCH', {
      ...data,
      price: data.price,
      quantity: data.quantity,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', projectId] });
      toast({ title: 'Услуга обновлена успешно' });
      setEditingService(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить услугу',
        variant: 'destructive'
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: number) => apiRequest(`/api/services/${serviceId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services', projectId] });
      toast({ title: 'Услуга удалена успешно' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить услугу',
        variant: 'destructive'
      });
    },
  });

  const onSubmit = (data: z.infer<typeof serviceFormSchema>) => {
    if (editingService) {
      updateServiceMutation.mutate(data);
    } else {
      createServiceMutation.mutate(data);
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = (products as any[]).find(p => p.id === productId);
    if (product) {
      form.setValue('productKey', product.name);
      form.setValue('description', product.description || product.name);
      form.setValue('price', product.price?.toString() || '0');
      form.setValue('isCustom', false);
    }
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    form.setValue('productKey', service.productKey || '');
    form.setValue('description', service.description);
    form.setValue('price', service.price.toString());
    form.setValue('quantity', service.quantity.toString());
    form.setValue('isCustom', service.isCustom || false);
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingService(null);
    form.reset();
  };

  const totalAmount = (services as Service[]).reduce((sum, service) => {
    return sum + (parseFloat(service.price.toString()) * parseFloat(service.quantity.toString()));
  }, 0);

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Проект не выбран</h3>
          <p className="text-gray-500">Выберите проект для управления услугами</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Услуги проекта</h1>
          <p className="text-gray-600">Управление услугами и материалами</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCloseDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить услугу
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingService ? 'Редактировать услугу' : 'Добавить новую услугу'}
              </DialogTitle>
              <DialogDescription>
                Выберите товар из каталога Invoice Ninja или создайте пользовательскую услугу
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="isCustom"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Пользовательская услуга</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!form.watch('isCustom') && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Выберите из каталога</label>
                    <Select onValueChange={handleProductSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите товар из каталога" />
                      </SelectTrigger>
                      <SelectContent>
                        {(products as any[]).map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex justify-between items-start w-full">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{product.name}</div>
                                <div className="text-xs text-gray-500 truncate">{product.description}</div>
                              </div>
                              <div className="text-sm font-medium text-blue-600 ml-2">€{product.price}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="productKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код товара</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Введите код товара" 
                          {...field} 
                          disabled={!form.watch('isCustom')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Описание услуги или товара" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Цена (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Количество</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                  >
                    {(createServiceMutation.isPending || updateServiceMutation.isPending) 
                      ? 'Сохранение...' 
                      : editingService ? 'Обновить' : 'Добавить'
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {(services as Service[]).map((service: Service) => (
            <Card key={service.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{service.description}</CardTitle>
                      {service.isCustom && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Пользовательская
                        </span>
                      )}
                    </div>
                    {service.productKey && (
                      <p className="text-sm text-gray-500 mt-1">Код: {service.productKey}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditService(service)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteServiceMutation.mutate(service.id)}
                      disabled={deleteServiceMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Цена:</span>
                    <div className="font-medium">€{parseFloat(service.price.toString()).toFixed(2)}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Количество:</span>
                    <div className="font-medium">{parseFloat(service.quantity.toString())}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Итого:</span>
                    <div className="font-medium">
                      €{(parseFloat(service.price.toString()) * parseFloat(service.quantity.toString())).toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {(services as Service[]).length === 0 && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Услуги не добавлены</h3>
              <p className="text-gray-500">Добавьте услуги и материалы для этого проекта</p>
            </div>
          )}

          {(services as Service[]).length > 0 && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-blue-900">Общая сумма:</span>
                  <span className="text-2xl font-bold text-blue-900">€{totalAmount.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}