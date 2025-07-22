import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface GoogleCalendarWidgetProps {
  projectId: number;
  crewId?: number;
  projectStatus: string;
}

export function GoogleCalendarWidget({ projectId, crewId, projectStatus }: GoogleCalendarWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const handleCreateCalendarEvents = async () => {
    if (!crewId) {
      toast({
        title: "Ошибка",
        description: "Не выбрана бригада для создания календарных событий",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest(`/api/calendar-demo/create-real-events/${projectId}/${crewId}`, 'POST');

      setLastResult(result);
      toast({
        title: "Успешно",
        description: result.message || "Календарные события созданы в Google Calendar",
        variant: "default"
      });
    } catch (error) {
      console.error('Error creating calendar events:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать календарные события в Google Calendar",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Calendar className="h-5 w-5" />
          Google Calendar Integration
        </CardTitle>
        <CardDescription>
          Автоматическое создание календарных событий для участников бригады
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={crewId ? "default" : "secondary"}>
              {crewId ? `Бригада #${crewId}` : "Бригада не назначена"}
            </Badge>
            <Badge variant="outline">{projectStatus}</Badge>
          </div>
          <Button
            onClick={handleCreateCalendarEvents}
            disabled={loading || !crewId}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Создание..." : "Создать события"}
          </Button>
        </div>

        {lastResult && (
          <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-md border">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Последние созданные события
            </h4>
            <div className="space-y-2">
              {lastResult.events?.map((event: any, index: number) => (
                <div key={index} className="text-xs space-y-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{event.memberName}</span>
                    <Badge variant="outline" className="text-xs">
                      {event.googleCalendarId}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span>{event.event.summary}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="h-3 w-3" />
                    <span>{event.event.location}</span>
                  </div>
                  <div className="text-gray-500 text-xs">
                    {event.event.startDate} - {event.event.endDate}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <p>💡 События будут созданы для всех участников бригады с указанным Google Calendar ID</p>
          <p>📅 События включают информацию о проекте, клиенте и адресе установки</p>
          <p>🔔 Участники получат уведомления в своих календарях Google</p>
        </div>
      </CardContent>
    </Card>
  );
}