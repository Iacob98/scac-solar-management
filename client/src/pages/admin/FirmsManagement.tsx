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
import { Plus, Building, ExternalLink, Edit } from 'lucide-react';
import type { Firm } from '@shared/schema';

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

  const { data: firms = [], isLoading } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <Card key={firm.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  {firm.logoUrl ? (
                    <img 
                      src={firm.logoUrl} 
                      alt={`${firm.name} logo`}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-xl">{firm.name}</CardTitle>
                    <CardDescription>
                      {firm.taxId && (
                        <span>Налоговый номер: {firm.taxId}</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
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

              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Создана: {new Date(firm.createdAt).toLocaleDateString('ru-RU')}
                </p>
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
    </div>
  );
}