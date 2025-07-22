import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Users, MapPin, Clock, Phone, AlertCircle, ExternalLink, ChevronLeft, ChevronRight, CalendarDays, CalendarRange, Move } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MainLayout } from '@/components/Layout/MainLayout';
import { useLocation } from 'wouter';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

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

type CalendarViewType = 'threeDays' | 'week' | 'month';

interface CalendarDayProps {
  day: Date;
  dayString: string;
  events: CalendarEvent[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onEventClick: (event: CalendarEvent) => void;
}

function CalendarDay({ day, dayString, events, isToday, isCurrentMonth, onEventClick }: CalendarDayProps) {
  const { setNodeRef } = useDroppable({
    id: dayString
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] border rounded-lg p-3 ${
        isToday ? 'bg-blue-50 border-blue-200' : 
        isCurrentMonth ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="text-center mb-2">
        <div className="font-semibold text-xs text-gray-600">
          {format(day, 'EEE', { locale: ru })}
        </div>
        <div className={`text-lg font-bold ${
          isToday ? 'text-blue-600' : 
          isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
        }`}>
          {format(day, 'd')}
        </div>
      </div>
      
      <div className="space-y-2">
        {events.map((event, eventIndex) => (
          <DraggableEvent 
            key={eventIndex}
            event={event}
            onClick={() => onEventClick(event)}
          />
        ))}
      </div>
    </div>
  );
}

interface DraggableEventProps {
  event: CalendarEvent;
  onClick: () => void;
}

function DraggableEvent({ event, onClick }: DraggableEventProps) {
  const eventId = JSON.stringify(event);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: eventId,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-2 cursor-move hover:shadow-md transition-shadow border-l-4 ${
        event.type === 'start' ? 'border-l-green-500 bg-green-50 hover:bg-green-100' :
        event.type === 'end' ? 'border-l-blue-500 bg-blue-50 hover:bg-blue-100' :
        'border-l-orange-500 bg-orange-50 hover:bg-orange-100'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div 
        className="text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className="font-semibold text-gray-900 truncate mb-1 flex items-center">
          <Move className="h-3 w-3 mr-1 text-gray-400" />
          {event.type === 'start' ? '🚀' : event.type === 'end' ? '✅' : '🔧'} Проект #{event.project.id}
        </div>
        <div className="text-gray-600 mb-1">
          <Users className="h-3 w-3 inline mr-1" />
          {event.crew.name}
        </div>
        {event.project.installationPersonAddress && (
          <div className="text-gray-500 truncate">
            <MapPin className="h-3 w-3 inline mr-1" />
            {event.project.installationPersonAddress}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<CalendarViewType>('week');
  const [, setLocation] = useLocation();
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const queryClient = useQueryClient();

  // Получаем firm ID из localStorage для запросов
  const selectedFirmId = localStorage.getItem('selectedFirmId');
  
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/projects?firmId=${selectedFirmId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!selectedFirmId
  });

  const { data: crews = [], isLoading: crewsLoading } = useQuery({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/crews?firmId=${selectedFirmId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch crews');
      return response.json();
    },
    enabled: !!selectedFirmId
  });

  // Функции навигации по календарю
  const navigatePrevious = () => {
    if (viewType === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewType === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
  };

  // Получаем дни для отображения в зависимости от вида
  const displayDays = useMemo(() => {
    if (viewType === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const startWeek = startOfWeek(start, { weekStartsOn: 1 });
      const endWeek = addDays(end, 6 - end.getDay());
      return eachDayOfInterval({ start: startWeek, end: endWeek });
    } else if (viewType === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 3 }, (_, i) => addDays(start, i));
    }
  }, [currentDate, viewType]);

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
    if (project.workStartDate && project.workEndDate) {
      const startDate = new Date(project.workStartDate);
      const endDate = new Date(project.workEndDate);
      let currentWorkDay = addDays(startDate, 1);
      
      while (currentWorkDay < endDate) {
        calendarEvents.push({
          project,
          crew,
          date: format(currentWorkDay, 'yyyy-MM-dd'),
          type: 'work'
        });
        currentWorkDay = addDays(currentWorkDay, 1);
      }
    }

  });

  // Группируем события по дням
  const eventsByDay = calendarEvents.reduce((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = [];
    }
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  // Функция для получения заголовка периода
  const getPeriodTitle = () => {
    if (viewType === 'month') {
      return format(currentDate, 'LLLL yyyy', { locale: ru });
    } else if (viewType === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, 'd MMM', { locale: ru })} - ${format(weekEnd, 'd MMM yyyy', { locale: ru })}`;
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 2);
      return `${format(start, 'd MMM', { locale: ru })} - ${format(end, 'd MMM yyyy', { locale: ru })}`;
    }
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return eventsByDay[dateStr] || [];
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'start': return '🚀';
      case 'end': return '✅';
      case 'work': return '🔧';
      default: return '📅';
    }
  };

  // Мутация для обновления дат проекта
  const updateProjectDatesMutation = useMutation({
    mutationFn: async ({ projectId, newDate, eventType }: {
      projectId: number;
      newDate: string;
      eventType: 'start' | 'end' | 'work';
    }) => {
      let updateData: any = {};
      
      if (eventType === 'start') {
        updateData.workStartDate = newDate;
      } else if (eventType === 'end') {
        updateData.workEndDate = newDate;
      }
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) throw new Error('Не удалось обновить дату проекта');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirmId] });
      toast({
        title: 'Успех',
        description: 'Дата проекта успешно обновлена'
      });
    },
    onError: () => {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить дату проекта',
        variant: 'destructive'
      });
    }
  });

  // Обработчики drag-and-drop
  const handleDragStart = (event: DragStartEvent) => {
    const eventData = JSON.parse(event.active.id as string);
    setDraggedEvent(eventData);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !draggedEvent) {
      setDraggedEvent(null);
      return;
    }
    
    const targetDate = over.id as string;
    const eventData = JSON.parse(active.id as string);
    
    // Проверяем, изменилась ли дата
    if (eventData.date === targetDate) {
      setDraggedEvent(null);
      return;
    }
    
    // Обновляем дату в проекте
    updateProjectDatesMutation.mutate({
      projectId: eventData.project.id,
      newDate: targetDate,
      eventType: eventData.type
    });
    
    setDraggedEvent(null);
  };

  if (projectsLoading || crewsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Загрузка календаря...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <CalendarIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold">Календарь проектов</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Переключатели видов */}
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewType === 'threeDays' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('threeDays')}
                className="px-3 py-1"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                3 дня
              </Button>
              <Button
                variant={viewType === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('week')}
                className="px-3 py-1"
              >
                <CalendarDays className="h-4 w-4 mr-1" />
                Неделя
              </Button>
              <Button
                variant={viewType === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewType('month')}
                className="px-3 py-1"
              >
                <CalendarRange className="h-4 w-4 mr-1" />
                Месяц
              </Button>
            </div>
            
            {/* Навигация */}
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={navigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={navigateToday}>
                Сегодня
              </Button>
              <Button variant="outline" size="sm" onClick={navigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Заголовок периода */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            {getPeriodTitle()}
          </h2>
        </div>

        {/* Календарная сетка */}
        <Card>
          <CardContent className="p-4">
            <div className={`grid gap-2 ${
              viewType === 'month' ? 'grid-cols-7' : 
              viewType === 'week' ? 'grid-cols-7' : 
              'grid-cols-3'
            }`}>
              {displayDays.map((day, index) => {
                const events = getEventsForDate(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = viewType === 'month' ? isSameMonth(day, currentDate) : true;
                const dayString = format(day, 'yyyy-MM-dd');
                
                return (
                  <CalendarDay
                    key={index}
                    day={day}
                    dayString={dayString}
                    events={events}
                    isToday={isToday}
                    isCurrentMonth={isCurrentMonth}
                    onEventClick={(event) => {
                      localStorage.setItem('selectedProjectId', event.project.id.toString());
                      setLocation('/projects');
                    }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        <DragOverlay>
          {draggedEvent && (
            <div className="p-2 bg-blue-100 border border-blue-300 rounded shadow-lg">
              <div className="font-semibold text-xs text-blue-900">
                {getEventTypeIcon(draggedEvent.type)} Проект #{draggedEvent.project.id}
              </div>
              <div className="text-blue-700 text-xs">
                <Users className="h-3 w-3 inline mr-1" />
                {draggedEvent.crew.name}
              </div>
            </div>
          )}
        </DragOverlay>

        </DndContext>

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
    </MainLayout>
  );
}