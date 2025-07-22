import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, TestTube } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

const firmEditSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  invoiceNinjaUrl: z.string().url('Неверный формат URL'),
  token: z.string().min(1, 'API токен обязателен'),
  address: z.string().optional(),
  taxId: z.string().optional(),
  // Postmark fields
  postmarkServerToken: z.string().optional(),
  postmarkFromEmail: z.string().email('Неверный формат email').optional().or(z.literal('')),
  postmarkMessageStream: z.string().optional(),
});

export default function FirmEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isTestingPostmark, setIsTestingPostmark] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: firm, isLoading } = useQuery({
    queryKey: ['/api/firms', id],
    queryFn: async () => {
      const response = await apiRequest(`/api/firms/${id}`, 'GET');
      return await response.json();
    },
    enabled: !!id,
  });

  const form = useForm<z.infer<typeof firmEditSchema>>({
    resolver: zodResolver(firmEditSchema),
    defaultValues: {
      name: '',
      invoiceNinjaUrl: '',
      token: '',
      address: '',
      taxId: '',
      postmarkServerToken: '',
      postmarkFromEmail: '',
      postmarkMessageStream: 'transactional',
    },
  });

  useEffect(() => {
    if (firm) {
      form.reset({
        name: firm.name || '',
        invoiceNinjaUrl: firm.invoiceNinjaUrl || '',
        token: firm.token || '',
        address: firm.address || '',
        taxId: firm.taxId || '',
        postmarkServerToken: firm.postmarkServerToken || '',
        postmarkFromEmail: firm.postmarkFromEmail || '',
        postmarkMessageStream: firm.postmarkMessageStream || 'transactional',
      });
    }
  }, [firm, form]);

  const updateFirmMutation = useMutation({
    mutationFn: (data: z.infer<typeof firmEditSchema>) => {
      return apiRequest(`/api/firms/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/firms'] });
      toast({
        title: 'Успех',
        description: 'Данные фирмы обновлены',
      });
      setLocation('/admin/firms');
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить данные фирмы',
        variant: 'destructive',
      });
    },
  });

  const testPostmarkMutation = useMutation({
    mutationFn: async (data: { token: string; fromEmail: string; messageStream: string }) => {
      const response = await apiRequest('/api/postmark/test', 'POST', data);
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Тест успешен',
        description: `Тестовое письмо отправлено на ${data.email}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка теста',
        description: error.message || 'Не удалось отправить тестовое письмо',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof firmEditSchema>) => {
    updateFirmMutation.mutate(data);
  };

  const handleTestPostmark = async () => {
    const values = form.getValues();
    if (!values.postmarkServerToken || !values.postmarkFromEmail) {
      toast({
        title: 'Ошибка',
        description: 'Заполните токен и email отправителя для теста',
        variant: 'destructive',
      });
      return;
    }

    setIsTestingPostmark(true);
    try {
      await testPostmarkMutation.mutateAsync({
        token: values.postmarkServerToken,
        fromEmail: values.postmarkFromEmail,
        messageStream: values.postmarkMessageStream || 'transactional',
      });
    } finally {
      setIsTestingPostmark(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!firm) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Фирма не найдена</h3>
          <p className="text-gray-500">Фирма с указанным ID не существует</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation('/admin/firms')} className="hover:bg-blue-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к фирмам
              </Button>
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">Редактирование фирмы</h1>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Основные данные</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название фирмы</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="invoiceNinjaUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Invoice Ninja</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://invoice.example.com" />
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
                        <FormLabel>API токен Invoice Ninja</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ИНН</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Postmark Integration */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold">Интеграция с Postmark</h3>
                  <p className="text-sm text-gray-600">
                    Настройте Postmark для автоматической отправки счетов клиентам по email
                  </p>

                  <FormField
                    control={form.control}
                    name="postmarkServerToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Server Token Postmark</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Вставьте токен из Postmark" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postmarkFromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email отправителя</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="noreply@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postmarkMessageStream"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message Stream</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="transactional" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestPostmark}
                    disabled={isTestingPostmark || testPostmarkMutation.isPending}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {isTestingPostmark ? 'Тестирование...' : 'Тестировать отправку'}
                  </Button>
                </div>

                <div className="flex justify-end space-x-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation('/admin/firms')}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={updateFirmMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateFirmMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}