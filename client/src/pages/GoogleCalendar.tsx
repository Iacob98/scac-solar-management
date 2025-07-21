import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CheckCircle, XCircle, ExternalLink, AlertCircle, Clock, Users, Settings, Key } from 'lucide-react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Схема для настроек Google Calendar API
const googleApiSettingsSchema = z.object({
  clientId: z.string().min(1, 'Client ID обязательно для заполнения'),
  clientSecret: z.string().min(1, 'Client Secret обязательно для заполнения'),
  redirectUri: z.string().min(1, 'Redirect URI обязательно для заполнения'),
  masterCalendarId: z.string().optional(),
});

type GoogleApiSettings = z.infer<typeof googleApiSettingsSchema>;

interface GoogleCalendarStatus {
  isConnected: boolean;
  hasTokens: boolean;
  tokenExpiry: string | null;
  hasMasterCalendar: boolean;
  masterCalendarId: string | null;
  masterCalendarUrl: string | null;
}

interface Crew {
  id: number;
  name: string;
  uniqueNumber: string;
  gcalId: string | null;
}

interface CalendarLog {
  id: number;
  timestamp: string;
  userId: string;
  action: string;
  projectId: number | null;
  eventId: string | null;
  status: 'success' | 'error';
  details: any;
}

export default function GoogleCalendar() {
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const queryClient = useQueryClient();
  const [authMessage, setAuthMessage] = useState<string>('');
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const form = useForm<GoogleApiSettings>({
    resolver: zodResolver(googleApiSettingsSchema),
    defaultValues: {
      clientId: '',
      clientSecret: '',
      redirectUri: window.location.origin + '/api/google/callback',
      masterCalendarId: '',
    },
  });

  // Загружаем существующие настройки API для фирмы
  const { data: apiSettings } = useQuery({
    queryKey: ['/api/google/settings', selectedFirmId],
    enabled: !!selectedFirmId,
  });

  // Обновляем форму при загрузке настроек
  useEffect(() => {
    const settings = apiSettings as any;
    if (settings?.configured) {
      form.setValue('clientId', settings.clientId || '');
      form.setValue('redirectUri', settings.redirectUri || window.location.origin + '/api/google/callback');
      form.setValue('masterCalendarId', settings.masterCalendarId || '');
    }
  }, [apiSettings, form]);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  // Проверяем URL параметры для сообщений об авторизации
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_auth') === 'success') {
      setAuthMessage('Google Calendar успешно подключен!');
      // Обновляем статус после успешной авторизации
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', selectedFirmId] });
    } else if (urlParams.get('google_auth') === 'error') {
      setAuthMessage('Ошибка подключения Google Calendar. Попробуйте еще раз.');
    }
    
    // Очищаем URL от параметров
    if (urlParams.has('google_auth')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [selectedFirmId, queryClient]);

  // Загружаем статус Google Calendar
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['/api/google/status', selectedFirmId],
    enabled: !!selectedFirmId,
  });

  // Загружаем бригады
  const { data: crews = [], isLoading: crewsLoading } = useQuery({
    queryKey: ['/api/crews', `?firm_id=${selectedFirmId}`],
    enabled: !!selectedFirmId,
  });

  // Загружаем логи календаря
  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['/api/google/logs'],
  });

  // Мутация для подключения Google Calendar
  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/google/connect/${selectedFirmId}`, 'GET');
      return response.json();
    },
    onSuccess: (data) => {
      // Открываем окно авторизации
      window.location.href = data.authUrl;
    },
    onError: (error) => {
      console.error('Ошибка подключения Google Calendar:', error);
      setAuthMessage('Ошибка получения ссылки для авторизации');
    }
  });

  // Мутация для создания корпоративного календаря
  const createMasterCalendarMutation = useMutation({
    mutationFn: () => apiRequest('/api/google/firm/create-master-calendar', 'POST', { firmId: selectedFirmId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/status', selectedFirmId] });
      setAuthMessage('Корпоративный календарь успешно создан!');
    },
    onError: (error) => {
      console.error('Ошибка создания корпоративного календаря:', error);
      setAuthMessage('Ошибка создания корпоративного календаря');
    }
  });

  // Мутация для создания календаря бригады
  const createCrewCalendarMutation = useMutation({
    mutationFn: (crewId: number) => apiRequest('/api/google/crew/create-calendar', 'POST', { crewId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
      setAuthMessage('Календарь бригады успешно создан!');
    },
    onError: (error) => {
      console.error('Ошибка создания календаря бригады:', error);
      setAuthMessage('Ошибка создания календаря бригады');
    }
  });

  // Мутация для сохранения настроек API
  const saveApiSettingsMutation = useMutation({
    mutationFn: (settings: GoogleApiSettings) => apiRequest(
      '/api/google/settings',
      'POST',
      { ...settings, firmId: selectedFirmId }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/status', selectedFirmId] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/settings', selectedFirmId] });
      setAuthMessage('Настройки API успешно сохранены!');
      setIsSettingsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error('Ошибка сохранения настроек API:', error);
      setAuthMessage('Ошибка сохранения настроек API');
    }
  });

  const onSubmitSettings = (values: GoogleApiSettings) => {
    saveApiSettingsMutation.mutate(values);
  };

  if (!selectedFirmId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              Выберите фирму для настройки Google Calendar
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statusLoading || crewsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Загрузка...</div>
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ошибка загрузки статуса Google Calendar
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (isConnected: boolean) => {
    return isConnected ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (isConnected: boolean) => {
    return isConnected ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />;
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Google Calendar
          </h1>
          <p className="text-muted-foreground">
            Интеграция с календарем для управления проектами и бригадами
          </p>
        </div>
        
        <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Настройки API
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Настройки Google Calendar API</DialogTitle>
              <DialogDescription>
                Введите данные из Google Cloud Console для подключения к API
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitSettings)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Введите Client ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="clientSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Введите Client Secret" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="redirectUri"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Redirect URI</FormLabel>
                      <FormControl>
                        <Input placeholder="Redirect URI" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="masterCalendarId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID корпоративного календаря (опционально)</FormLabel>
                      <FormControl>
                        <Input placeholder="calendar@company.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={saveApiSettingsMutation.isPending}>
                    {saveApiSettingsMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {authMessage && (
        <Alert className={authMessage.includes('успешно') ? 'border-green-500' : 'border-red-500'}>
          <AlertDescription>{authMessage}</AlertDescription>
        </Alert>
      )}

      {/* Инструкции по настройке */}
      {!(status as any)?.hasTokens && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Настройка Google Calendar API
            </CardTitle>
            <CardDescription>
              Для подключения к Google Calendar необходимо создать проект в Google Cloud Console
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">1. Создайте проект в Google Cloud Console</h4>
                  <p className="text-muted-foreground">
                    Перейдите в <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a> и создайте новый проект
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">2. Включите Google Calendar API</h4>
                  <p className="text-muted-foreground">
                    В разделе "APIs & Services" найдите и включите Google Calendar API
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">3. Создайте OAuth 2.0 учетные данные</h4>
                  <p className="text-muted-foreground">
                    В разделе "Credentials" создайте OAuth 2.0 Client ID для веб-приложения
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">4. Настройте Redirect URI</h4>
                  <p className="text-muted-foreground">
                    Добавьте <code className="bg-muted px-1 rounded">{window.location.origin + '/api/google/callback'}</code> в список разрешенных URI
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-muted-foreground">
                  После создания учетных данных нажмите кнопку "Настройки API" выше и введите полученные Client ID и Client Secret.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Статус подключения */}
      <Card>
        <CardHeader>
          <CardTitle>Статус подключения</CardTitle>
          <CardDescription>
            Текущее состояние интеграции с Google Calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className={getStatusColor((status as any)?.hasTokens || false)}>
                {getStatusIcon((status as any)?.hasTokens || false)}
              </div>
              <span className="text-sm">OAuth подключение</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={getStatusColor((status as any)?.hasMasterCalendar || false)}>
                {getStatusIcon((status as any)?.hasMasterCalendar || false)}
              </div>
              <span className="text-sm">Корпоративный календарь</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {(status as any)?.tokenExpiry 
                  ? `Токен до ${new Date((status as any).tokenExpiry).toLocaleDateString()}`
                  : 'Токены отсутствуют'
                }
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {(crews as any[])?.filter((crew: any) => crew.gcalId)?.length || 0} из {(crews as any[])?.length || 0} бригад
              </span>
            </div>
          </div>

          {!(status as any)?.hasTokens && (
            <div className="pt-4">
              <Button 
                onClick={() => connectGoogleMutation.mutate()} 
                disabled={connectGoogleMutation.isPending}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {connectGoogleMutation.isPending ? 'Подключение...' : 'Подключить Google Calendar'}
              </Button>
            </div>
          )}

          {(status as any)?.hasTokens && !(status as any)?.hasMasterCalendar && (
            <div className="pt-4">
              <Button 
                onClick={() => createMasterCalendarMutation.mutate()} 
                disabled={createMasterCalendarMutation.isPending}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {createMasterCalendarMutation.isPending ? 'Создание...' : 'Создать корпоративный календарь'}
              </Button>
            </div>
          )}

          {(status as any)?.masterCalendarUrl && (
            <div className="pt-4">
              <Button 
                variant="outline" 
                asChild
                className="flex items-center gap-2"
              >
                <a href={(status as any).masterCalendarUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Открыть корпоративный календарь
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Календари бригад */}
      {(status as any)?.hasTokens && (
        <Card>
          <CardHeader>
            <CardTitle>Календари бригад</CardTitle>
            <CardDescription>
              Управление календарями для каждой бригады
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(crews as any[])?.map((crew: any) => (
                <div key={crew.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={getStatusColor(!!crew.gcalId)}>
                      {getStatusIcon(!!crew.gcalId)}
                    </div>
                    <div>
                      <div className="font-medium">{crew.name}</div>
                      <div className="text-sm text-muted-foreground">{crew.uniqueNumber}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {crew.gcalId ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        Подключен
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-gray-600">
                          Не подключен
                        </Badge>
                        <Button 
                          size="sm" 
                          onClick={() => createCrewCalendarMutation.mutate(crew.id)}
                          disabled={createCrewCalendarMutation.isPending}
                        >
                          {createCrewCalendarMutation.isPending ? 'Создание...' : 'Создать календарь'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              
              {(crews as any[])?.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Нет созданных бригад
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Логи операций */}
      {(logs as any[])?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Последние операции</CardTitle>
            <CardDescription>
              История операций с Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(logs as any[])?.slice(0, 10)?.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                  <div className="flex items-center gap-3">
                    <div className={getStatusColor(log.status === 'success')}>
                      {getStatusIcon(log.status === 'success')}
                    </div>
                    <div>
                      <div className="font-medium">{getActionName(log.action)}</div>
                      <div className="text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {log.projectId && (
                    <Badge variant="outline">
                      Проект #{log.projectId}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </MainLayout>
  );
}

function getActionName(action: string): string {
  const actionNames: Record<string, string> = {
    'create_master_calendar': 'Создание корпоративного календаря',
    'create_crew_calendar': 'Создание календаря бригады',
    'sync_project': 'Синхронизация проекта',
    'update_crew_members': 'Обновление участников бригады',
    'create_event': 'Создание события',
    'update_event': 'Обновление события',
    'delete_event': 'Удаление события'
  };
  
  return actionNames[action] || action;
}