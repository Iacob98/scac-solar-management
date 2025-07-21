import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Calendar, CheckCircle, XCircle, ExternalLink, AlertCircle, Clock, Users } from 'lucide-react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { apiRequest } from '@/lib/queryClient';

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
  const { data: status, isLoading: statusLoading, error: statusError } = useQuery<GoogleCalendarStatus>({
    queryKey: ['google-calendar-status', selectedFirmId],
    queryFn: () => apiRequest(`/api/google/status/${selectedFirmId}`),
    enabled: !!selectedFirmId,
  });

  // Загружаем бригады
  const { data: crews = [], isLoading: crewsLoading } = useQuery<Crew[]>({
    queryKey: ['crews', selectedFirmId],
    queryFn: () => apiRequest(`/api/crews`),
    enabled: !!selectedFirmId,
  });

  // Загружаем логи календаря
  const { data: logs = [], isLoading: logsLoading } = useQuery<CalendarLog[]>({
    queryKey: ['calendar-logs'],
    queryFn: () => apiRequest('/api/google/logs'),
  });

  // Мутация для подключения Google Calendar
  const connectGoogleMutation = useMutation({
    mutationFn: () => apiRequest(`/api/google/connect/${selectedFirmId}`),
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
    mutationFn: () => apiRequest('/api/google/firm/create-master-calendar', {
      method: 'POST',
      body: JSON.stringify({ firmId: selectedFirmId }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status', selectedFirmId] });
      setAuthMessage('Корпоративный календарь успешно создан!');
    },
    onError: (error) => {
      console.error('Ошибка создания корпоративного календаря:', error);
      setAuthMessage('Ошибка создания корпоративного календаря');
    }
  });

  // Мутация для создания календаря бригады
  const createCrewCalendarMutation = useMutation({
    mutationFn: (crewId: number) => apiRequest('/api/google/crew/create-calendar', {
      method: 'POST',
      body: JSON.stringify({ crewId }),
      headers: { 'Content-Type': 'application/json' }
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crews', selectedFirmId] });
      setAuthMessage('Календарь бригады успешно создан!');
    },
    onError: (error) => {
      console.error('Ошибка создания календаря бригады:', error);
      setAuthMessage('Ошибка создания календаря бригады');
    }
  });

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
      </div>

      {authMessage && (
        <Alert className={authMessage.includes('успешно') ? 'border-green-500' : 'border-red-500'}>
          <AlertDescription>{authMessage}</AlertDescription>
        </Alert>
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
              <div className={getStatusColor(status?.hasTokens || false)}>
                {getStatusIcon(status?.hasTokens || false)}
              </div>
              <span className="text-sm">OAuth подключение</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={getStatusColor(status?.hasMasterCalendar || false)}>
                {getStatusIcon(status?.hasMasterCalendar || false)}
              </div>
              <span className="text-sm">Корпоративный календарь</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {status?.tokenExpiry 
                  ? `Токен до ${new Date(status.tokenExpiry).toLocaleDateString()}`
                  : 'Токены отсутствуют'
                }
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {crews.filter(crew => crew.gcalId).length} из {crews.length} бригад
              </span>
            </div>
          </div>

          {!status?.hasTokens && (
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

          {status?.hasTokens && !status?.hasMasterCalendar && (
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

          {status?.masterCalendarUrl && (
            <div className="pt-4">
              <Button 
                variant="outline" 
                asChild
                className="flex items-center gap-2"
              >
                <a href={status.masterCalendarUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Открыть корпоративный календарь
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Календари бригад */}
      {status?.hasTokens && (
        <Card>
          <CardHeader>
            <CardTitle>Календари бригад</CardTitle>
            <CardDescription>
              Управление календарями для каждой бригады
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {crews.map((crew) => (
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
              
              {crews.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  Нет созданных бригад
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Логи операций */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Последние операции</CardTitle>
            <CardDescription>
              История операций с Google Calendar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.slice(0, 10).map((log) => (
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