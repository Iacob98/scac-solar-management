import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
  description?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
  }>;
  colorId?: string;
}

interface GoogleCalendarWidgetProps {
  firmId: string;
  className?: string;
  maxEvents?: number;
}

export function GoogleCalendarWidget({ firmId, className = '', maxEvents = 10 }: GoogleCalendarWidgetProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Получаем статус подключения
  const { data: status } = useQuery({
    queryKey: ['/api/google/status', firmId],
    queryFn: async () => {
      const response = await fetch(`/api/google/status/${firmId}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch status');
      return response.json();
    },
  });

  // Получаем события календаря
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['/api/google/events', firmId, selectedDate.toISOString().split('T')[0]],
    queryFn: async () => {
      const response = await fetch(`/api/google/events/${firmId}?date=${selectedDate.toISOString().split('T')[0]}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: status?.hasTokens && status?.hasMasterCalendar,
  });

  // Форматирование времени
  const formatTime = (dateTimeString?: string, dateString?: string) => {
    if (dateTimeString) {
      return new Date(dateTimeString).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (dateString) {
      return 'Весь день';
    }
    return '';
  };

  // Форматирование даты
  const formatDate = (dateTimeString?: string, dateString?: string) => {
    const date = new Date(dateTimeString || dateString || '');
    return date.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  // Цвета для событий
  const getEventColor = (colorId?: string) => {
    const colors: Record<string, string> = {
      '1': 'bg-blue-100 text-blue-800 border-blue-200',
      '2': 'bg-green-100 text-green-800 border-green-200', 
      '3': 'bg-purple-100 text-purple-800 border-purple-200',
      '4': 'bg-red-100 text-red-800 border-red-200',
      '5': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      '6': 'bg-orange-100 text-orange-800 border-orange-200',
      '7': 'bg-cyan-100 text-cyan-800 border-cyan-200',
      '8': 'bg-gray-100 text-gray-800 border-gray-200',
      '9': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      '10': 'bg-emerald-100 text-emerald-800 border-emerald-200',
      '11': 'bg-rose-100 text-rose-800 border-rose-200',
    };
    return colors[colorId || '1'] || colors['1'];
  };

  if (!status?.hasTokens || !status?.hasMasterCalendar) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Google Calendar не подключен</p>
            <p className="text-sm">Настройте интеграцию в разделе Календарь</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar
        </CardTitle>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="px-3 py-1 border rounded-md text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDate(new Date())}
          >
            Сегодня
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {events.slice(0, maxEvents).map((event: CalendarEvent) => (
              <div
                key={event.id}
                className={`p-3 rounded-lg border ${getEventColor(event.colorId)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{event.summary || 'Без названия'}</h4>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm opacity-75">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(event.start.dateTime, event.start.date)}
                        {event.end.dateTime && event.start.dateTime && 
                          ` - ${formatTime(event.end.dateTime, event.end.date)}`
                        }
                      </div>
                      
                      {event.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{event.attendees.length}</span>
                        </div>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="text-xs mt-2 opacity-75 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {events.length > maxEvents && (
              <div className="text-center py-2">
                <Badge variant="secondary">
                  и еще {events.length - maxEvents} событий
                </Badge>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Нет событий на выбранную дату</p>
            <p className="text-sm">Выберите другую дату или создайте новое событие</p>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="w-full"
          >
            Обновить календарь
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}