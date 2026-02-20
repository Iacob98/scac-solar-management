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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, TestTube } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const firmEditSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  invoiceNinjaUrl: z.string().url('Неверный формат URL'),
  token: z.string().min(1, 'API токен обязателен'),
  address: z.string().optional(),
  taxId: z.string().optional(),
  // SMTP fields
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean().optional(),
  smtpFrom: z.string().email('Неверный формат email').optional().or(z.literal('')),
  // Email template fields
  emailSubjectTemplate: z.string().optional(),
  emailBodyTemplate: z.string().optional(),
});

export default function FirmEdit() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
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
      smtpHost: '',
      smtpPort: '587',
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: false,
      smtpFrom: '',
      emailSubjectTemplate: 'Счет №{{invoiceNumber}} от {{firmName}}',
      emailBodyTemplate: 'Уважаемый {{clientName}},\n\nВо вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.\n\nС уважением,\n{{firmName}}',
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
        smtpHost: firm.smtpHost || '',
        smtpPort: firm.smtpPort || '587',
        smtpUser: firm.smtpUser || '',
        smtpPassword: firm.smtpPassword || '',
        smtpSecure: firm.smtpSecure || false,
        smtpFrom: firm.smtpFrom || '',
        emailSubjectTemplate: firm.emailSubjectTemplate || 'Счет №{{invoiceNumber}} от {{firmName}}',
        emailBodyTemplate: firm.emailBodyTemplate || 'Уважаемый {{clientName}},\n\nВо вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.\n\nС уважением,\n{{firmName}}',
      });
    }
  }, [firm, form]);

  const updateFirmMutation = useMutation({
    mutationFn: (data: z.infer<typeof firmEditSchema>) => {
      return apiRequest(`/api/firms/${id}`, 'PUT', data);
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

  const testSmtpMutation = useMutation({
    mutationFn: async (data: { host: string; port: string; smtpUser: string; password: string; secure: boolean; fromEmail: string; testEmail?: string }) => {
      const response = await apiRequest('/api/smtp/test', 'POST', data);
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
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

  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);

  const handleTestSmtp = async () => {
    const values = form.getValues();
    if (!values.smtpHost || !values.smtpFrom) {
      toast({
        title: 'Ошибка',
        description: 'Заполните SMTP сервер и email отправителя для теста',
        variant: 'destructive',
      });
      return;
    }

    setShowTestEmailDialog(true);
  };

  const sendTestEmail = async () => {
    const values = form.getValues();
    setIsTestingSmtp(true);
    try {
      await testSmtpMutation.mutateAsync({
        host: values.smtpHost || '',
        port: values.smtpPort || '587',
        smtpUser: values.smtpUser || '',
        password: values.smtpPassword || '',
        secure: values.smtpSecure || false,
        fromEmail: values.smtpFrom || '',
        testEmail: testEmailAddress || undefined,
      });
      setShowTestEmailDialog(false);
      setTestEmailAddress('');
    } finally {
      setIsTestingSmtp(false);
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
    <>
      <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Тестовая отправка Email</DialogTitle>
            <DialogDescription>
              Укажите email адрес для тестовой отправки. Если оставить поле пустым,
              письмо будет отправлено на ваш email ({user?.email || 'текущий пользователь'}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestEmailDialog(false)}>
              Отмена
            </Button>
            <Button onClick={sendTestEmail} disabled={isTestingSmtp}>
              {isTestingSmtp ? 'Отправка...' : 'Отправить тест'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

                {/* SMTP Integration */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold">Настройки SMTP</h3>
                  <p className="text-sm text-gray-600">
                    Настройте SMTP для автоматической отправки счетов клиентам по email
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SMTP сервер</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="smtp.example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Порт</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="587" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="smtpUser"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Логин</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="user@example.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="smtpPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Пароль</FormLabel>
                          <FormControl>
                            <Input {...field} type="password" placeholder="••••••••" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="smtpFrom"
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
                    name="smtpSecure"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          SSL/TLS (порт 465)
                        </FormLabel>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestSmtp}
                    disabled={isTestingSmtp || testSmtpMutation.isPending}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {isTestingSmtp ? 'Тестирование...' : 'Тестировать отправку'}
                  </Button>
                </div>

                {/* Email Templates */}
                <div className="space-y-4 pt-6 border-t">
                  <h3 className="text-lg font-semibold">Шаблоны Email</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Настройте шаблоны для отправки счетов. Используйте переменные:
                    <code className="bg-gray-100 px-1 mx-1">{"{{invoiceNumber}}"}</code>- номер счета,
                    <code className="bg-gray-100 px-1 mx-1">{"{{firmName}}"}</code>- название фирмы,
                    <code className="bg-gray-100 px-1 mx-1">{"{{clientName}}"}</code>- имя клиента
                  </p>

                  <FormField
                    control={form.control}
                    name="emailSubjectTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тема письма</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Счет №{{invoiceNumber}} от {{firmName}}" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emailBodyTemplate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Текст письма</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            rows={6}
                            placeholder="Уважаемый {{clientName}},&#10;&#10;Во вложении находится счет №{{invoiceNumber}} за установку солнечных панелей.&#10;&#10;С уважением,&#10;{{firmName}}"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
    </>
  );
}