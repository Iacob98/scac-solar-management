import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, CheckCircle, XCircle, ExternalLink, Settings } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';

interface GoogleStatus {
  isConfigured: boolean;
  isAuthorized: boolean;
  hasSettings: boolean;
}

interface GoogleSettings {
  firmId: string;
  redirectUri: string;
  masterCalendarId?: string;
  hasCredentials: boolean;
}

export default function GoogleCalendarSetup() {
  const [selectedFirm, setSelectedFirm] = useState<string>('');
  const [masterCalendarId, setMasterCalendarId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirm(firmId);
    }
  }, []);

  // Запрос статуса Google Calendar
  const { data: status, isLoading: statusLoading } = useQuery<GoogleStatus>({
    queryKey: [`/api/google/status/${selectedFirm}`],
    enabled: !!selectedFirm,
  });

  // Запрос настроек Google Calendar
  const { data: settings, isLoading: settingsLoading } = useQuery<GoogleSettings>({
    queryKey: [`/api/google/settings/${selectedFirm}`],
    enabled: !!selectedFirm && status?.isConfigured,
  });

  // Мутация для обновления настроек
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { masterCalendarId: string }) => {
      return apiRequest(`/api/google/settings/${selectedFirm}`, 'PUT', data);
    },
    onSuccess: () => {
      toast({
        title: "Настройки обновлены",
        description: "Настройки Google Calendar успешно сохранены",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/google/settings/${selectedFirm}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/google/status/${selectedFirm}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить настройки",
        variant: "destructive",
      });
    },
  });

  // Мутация для получения URL авторизации
  const getAuthUrlMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/google/auth/${selectedFirm}`, 'GET');
    },
    onSuccess: (data: any) => {
      // Открываем URL авторизации в новом окне
      window.open(data.authUrl, '_blank', 'width=600,height=600');
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось получить URL авторизации",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({ masterCalendarId });
  };

  const handleAuthorize = () => {
    getAuthUrlMutation.mutate();
  };

  if (!selectedFirm) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertDescription>
            Выберите фирму для настройки Google Calendar интеграции
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (statusLoading || settingsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Google Calendar Integration</h1>
          <p className="text-gray-600">Настройка автоматического создания календарных событий</p>
        </div>
      </div>

      {/* Статус интеграции */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Статус интеграции
          </CardTitle>
          <CardDescription>
            Текущее состояние Google Calendar интеграции для вашей фирмы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {status?.hasSettings ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="font-medium">OAuth Credentials</div>
                <div className="text-sm text-gray-600">
                  {status?.hasSettings ? 'Настроены' : 'Требуется настройка'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status?.isAuthorized ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="font-medium">Авторизация</div>
                <div className="text-sm text-gray-600">
                  {status?.isAuthorized ? 'Авторизован' : 'Требуется авторизация'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {status?.isConfigured ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <div>
                <div className="font-medium">Готовность</div>
                <div className="text-sm text-gray-600">
                  {status?.isConfigured ? 'Готов к использованию' : 'Требуется настройка'}
                </div>
              </div>
            </div>
          </div>

          {!status?.isAuthorized && status?.hasSettings && (
            <div className="pt-4 border-t">
              <Button 
                onClick={handleAuthorize}
                disabled={getAuthUrlMutation.isPending}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {getAuthUrlMutation.isPending ? 'Получение URL...' : 'Авторизовать Google Calendar'}
              </Button>
              <p className="text-sm text-gray-600 mt-2">
                Откроется новое окно для авторизации в Google Calendar
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Настройки */}
      {status?.hasSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Настройки календаря</CardTitle>
            <CardDescription>
              Дополнительные параметры для Google Calendar интеграции
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="masterCalendar">Master Calendar ID (опционально)</Label>
              <Input
                id="masterCalendar"
                type="text"
                placeholder="primary или ID конкретного календаря"
                value={masterCalendarId}
                onChange={(e) => setMasterCalendarId(e.target.value)}
              />
              <p className="text-sm text-gray-600">
                Оставьте пустым для использования основного календаря или укажите ID календаря фирмы
              </p>
            </div>

            <Button 
              onClick={handleSaveSettings}
              disabled={updateSettingsMutation.isPending}
              className="w-full"
            >
              {updateSettingsMutation.isPending ? 'Сохранение...' : 'Сохранить настройки'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Инструкции по настройке */}
      {!status?.hasSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Настройка Google Calendar API</CardTitle>
            <CardDescription>
              Для использования интеграции необходимо настроить Google Calendar API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                OAuth credentials уже настроены в системе. Теперь нужна авторизация для доступа к календарям.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <h4 className="font-medium">Что происходит при авторизации:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Открывается страница авторизации Google</li>
                <li>Вы предоставляете доступ к Google Calendar</li>
                <li>Система получает токены для создания событий</li>
                <li>Участники бригад смогут получать календарные события</li>
              </ul>
            </div>

            {settings?.redirectUri && (
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="text-sm">
                  <strong>Redirect URI:</strong> {settings.redirectUri}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Статус готовности */}
      {status?.isConfigured && status?.isAuthorized && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Google Calendar готов к использованию
            </CardTitle>
            <CardDescription className="text-green-600">
              Система настроена и готова автоматически создавать календарные события для участников бригад
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant="outline" className="text-green-700 border-green-300">
                ✓ OAuth настроен
              </Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">
                ✓ Авторизация завершена
              </Badge>
              <Badge variant="outline" className="text-green-700 border-green-300">
                ✓ Готов к созданию событий
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}