import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Users, MapPin, Clock, Phone, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface Project {
  id: number;
  status: string;
  workStartDate: string;
  workEndDate: string;
  installationPersonFirstName: string;
  installationPersonLastName: string;
  installationPersonAddress: string;
  installationPersonPhone: string;
  crewId: number;
}

interface Crew {
  id: number;
  name: string;
  leaderName: string;
  phone: string;
  status: string;
}

interface CalendarEvent {
  project: Project;
  crew: Crew;
  date: string;
  type: 'start' | 'end' | 'work';
}

export default function Calendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects']
  });

  const { data: crews = [], isLoading: crewsLoading } = useQuery({
    queryKey: ['/api/crews']
  });

  // Создаем события календаря из проектов
  const calendarEvents: CalendarEvent[] = [];
  
  projects.forEach((project: Project) => {
    const crew = crews.find((c: Crew) => c.id === project.crewId);
    if (!crew || project.status === 'completed' || project.status === 'cancelled') return;

    if (project.workStartDate) {
      calendarEvents.push({
        project,
        crew,
        date: project.workStartDate,
        type: 'start'
      });
    }

    if (project.workEndDate && project.workEndDate !== project.workStartDate) {
      calendarEvents.push({
        project,
        crew,
        date: project.workEndDate,
        type: 'end'
      });
    }

    // Добавляем рабочие дни между началом и концом
    // Добавляем рабочие дни между началом и концом (упрощенная версия)
    if (project.workStartDate && project.workEndDate) {
      const start = new Date(project.workStartDate);
      const end = new Date(project.workEndDate);
      
      // Простая итерация по дням между датами
      const currentDate = new Date(start);
      while (currentDate <= end) {
        if (currentDate.toISOString().split('T')[0] !== project.workStartDate && 
            currentDate.toISOString().split('T')[0] !== project.workEndDate) {
          calendarEvents.push({
            project,
            crew,
            date: currentDate.toISOString().split('T')[0],
            type: 'work'
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  });

  // Простое создание дней недели
  const today = new Date();
  const startOfCurrentWeek = new Date(today);
  startOfCurrentWeek.setDate(today.getDate() - today.getDay() + 1); // Понедельник
  
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfCurrentWeek);
    day.setDate(startOfCurrentWeek.getDate() + i);
    weekDays.push(day);
  }

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return calendarEvents.filter(event => event.date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-yellow-100 text-yellow-800';
      case 'work_in_progress': return 'bg-blue-100 text-blue-800';
      case 'equipment_ready': return 'bg-green-100 text-green-800';
      case 'equipment_delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'start': return '🚀';
      case 'end': return '✅';
      case 'work': return '🔧';
      default: return '📅';
    }
  };

  if (projectsLoading || crewsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Загрузка календаря...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <CalendarIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Календарь проектов</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            ← Предыдущая неделя
          </Button>
          <Button variant="outline">
            Сегодня
          </Button>
          <Button variant="outline">
            Следующая неделя →
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-center">
            Календарь проектов - текущая неделя
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map((day, index) => {
              const events = getEventsForDate(day);
              const isToday = day.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={index}
                  className={`min-h-[200px] border rounded-lg p-3 ${
                    isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="text-center mb-2">
                    <div className="font-semibold text-sm text-gray-600">
                      {day.toLocaleDateString('ru', { weekday: 'short' })}
                    </div>
                    <div className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {events.map((event, eventIndex) => (
                      <Card key={eventIndex} className="p-2 bg-white shadow-sm border-l-4 border-blue-500">
                        <div className="text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">
                              {getEventTypeIcon(event.type)} Проект #{event.project.id}
                            </span>
                            <Badge className={getStatusColor(event.project.status)} variant="secondary">
                              {event.project.status === 'planning' && 'Планирование'}
                              {event.project.status === 'work_in_progress' && 'В работе'}
                              {event.project.status === 'equipment_ready' && 'Готово'}
                              {event.project.status === 'equipment_delayed' && 'Задержка'}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center text-gray-600 mb-1">
                            <Users className="h-3 w-3 mr-1" />
                            <span className="truncate">{event.crew.name}</span>
                          </div>
                          
                          <div className="flex items-center text-gray-600 mb-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="truncate">
                              {event.project.installationPersonAddress || 'Адрес не указан'}
                            </span>
                          </div>
                          
                          {event.project.installationPersonPhone && (
                            <div className="flex items-center text-gray-600">
                              <Phone className="h-3 w-3 mr-1" />
                              <span>{event.project.installationPersonPhone}</span>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Статистика активных проектов */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные проекты</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter((p: Project) => p.status === 'work_in_progress').length}
            </div>
            <p className="text-xs text-muted-foreground">В работе сейчас</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные бригады</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {crews.filter((c: Crew) => c.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Готовы к работе</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Планируемые проекты</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {projects.filter((p: Project) => p.status === 'planning').length}
            </div>
            <p className="text-xs text-muted-foreground">Требуют внимания</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}