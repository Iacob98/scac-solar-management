import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  ChevronRight as ArrowRight,
  FileEdit,
  Package,
  PackageCheck,
  CalendarCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CalendarEvent {
  id: number;
  title: string;
  start: string | null;
  end: string | null;
  status: string;
  address: string | null;
  personName: string;
  type?: 'project' | 'reclamation';
  reclamationStatus?: string;
  projectId?: number;
}

interface CalendarResponse {
  month: number;
  year: number;
  events: CalendarEvent[];
}

// Status configuration with colors, labels, and icons
const statusConfig: Record<string, {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
  icon: any;
}> = {
  planning: {
    label: 'Планирование',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    icon: FileEdit
  },
  equipment_waiting: {
    label: 'Ждём оборудование',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    icon: Package
  },
  equipment_arrived: {
    label: 'Оборудование есть',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    icon: PackageCheck
  },
  work_scheduled: {
    label: 'Запланировано',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    icon: CalendarCheck
  },
  work_in_progress: {
    label: 'В работе',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    icon: Wrench
  },
  work_completed: {
    label: 'Завершено',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    icon: CheckCircle2
  },
  reclamation: {
    label: 'Рекламация',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    icon: AlertTriangle
  },
};

const getStatusConfig = (status: string) => {
  return statusConfig[status] || {
    label: status,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    icon: FileEdit
  };
};

export default function WorkerCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery<CalendarResponse>({
    queryKey: ['/api/worker/calendar', currentDate.getMonth() + 1, currentDate.getFullYear()],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/worker/calendar?month=${currentDate.getMonth() + 1}&year=${currentDate.getFullYear()}`,
        'GET'
      );
      return response.json();
    },
    // Auto-refresh every 30 seconds for real-time sync
    refetchInterval: 30000,
    // Refetch when window gets focus
    refetchOnWindowFocus: true,
  });

  // Prefetch adjacent months for smooth navigation
  useEffect(() => {
    const prevMonth = subMonths(currentDate, 1);
    const nextMonth = addMonths(currentDate, 1);

    // Prefetch previous month
    queryClient.prefetchQuery({
      queryKey: ['/api/worker/calendar', prevMonth.getMonth() + 1, prevMonth.getFullYear()],
      queryFn: async () => {
        const response = await apiRequest(
          `/api/worker/calendar?month=${prevMonth.getMonth() + 1}&year=${prevMonth.getFullYear()}`,
          'GET'
        );
        return response.json();
      },
    });

    // Prefetch next month
    queryClient.prefetchQuery({
      queryKey: ['/api/worker/calendar', nextMonth.getMonth() + 1, nextMonth.getFullYear()],
      queryFn: async () => {
        const response = await apiRequest(
          `/api/worker/calendar?month=${nextMonth.getMonth() + 1}&year=${nextMonth.getFullYear()}`,
          'GET'
        );
        return response.json();
      },
    });
  }, [currentDate, queryClient]);

  const events = data?.events || [];

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter((event) => {
      if (!event.start) return false;
      // Compare date strings to avoid timezone issues
      const startStr = event.start.split('T')[0]; // Get just the date part
      const endStr = event.end ? event.end.split('T')[0] : startStr;
      return dayStr >= startStr && dayStr <= endStr;
    });
  };

  // Get events for selected date
  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Calculate start day offset (Monday = 0)
  const startDayOffset = (monthStart.getDay() + 6) % 7;

  return (
    <WorkerLayout title="Calendar">
      <div className="p-4 space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h2 className="font-semibold">
              {format(currentDate, 'LLLL yyyy', { locale: ru })}
            </h2>
            <Button variant="link" size="sm" onClick={goToToday} className="text-xs">
              Today
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardContent className="p-2">
            {/* Day Headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-500 py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: startDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {days.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'aspect-square rounded-lg flex flex-col items-center justify-center relative',
                      'hover:bg-gray-100 transition-colors',
                      isToday && 'bg-primary/10',
                      isSelected && 'ring-2 ring-primary',
                      !isSameMonth(day, currentDate) && 'text-gray-300'
                    )}
                  >
                    <span
                      className={cn(
                        'text-sm',
                        isToday && 'font-bold text-primary'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {hasEvents && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((event, i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-2 h-2 rounded-full',
                              getStatusConfig(event.status).dotColor
                            )}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-gray-500">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Events */}
        {selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">
                {format(selectedDate, 'd MMMM', { locale: ru })}
              </h3>
              {isFetching && (
                <span className="text-xs text-gray-400 animate-pulse">Syncing...</span>
              )}
            </div>
            {selectedDayEvents.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-gray-500">
                  Нет запланированных проектов
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((event) => {
                  const config = getStatusConfig(event.status);
                  const StatusIcon = config.icon;

                  return (
                    <Card
                      key={`${event.type || 'project'}-${event.id}`}
                      className={cn(
                        'hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] border-l-4',
                        config.dotColor.replace('bg-', 'border-')
                      )}
                      onClick={() => {
                        if (event.type === 'reclamation' && event.projectId) {
                          // Navigate to project detail where reclamation section is shown
                          navigate(`/worker/projects/${event.projectId}`);
                        } else {
                          navigate(`/worker/projects/${event.id}`);
                        }
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Status Icon */}
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                            config.bgColor
                          )}>
                            <StatusIcon className={cn('w-5 h-5', config.textColor)} />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Title */}
                            <h4 className="font-semibold text-gray-900 truncate">
                              {event.type === 'reclamation' ? event.title : (event.personName || event.title)}
                            </h4>
                            {event.type === 'reclamation' && event.personName && (
                              <p className="text-sm text-gray-600 truncate">{event.personName}</p>
                            )}

                            {/* Status Badge */}
                            <div className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                              config.bgColor,
                              config.textColor
                            )}>
                              <div className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
                              {config.label}
                            </div>

                            {/* Address */}
                            {event.address && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-600 mt-2">
                                <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                                <span className="truncate">{event.address}</span>
                              </div>
                            )}

                            {/* Date */}
                            {event.start && (
                              <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                                <Clock className="w-4 h-4 flex-shrink-0 text-gray-400" />
                                <span>
                                  {format(new Date(event.start), 'd MMMM', { locale: ru })}
                                  {event.end && event.end !== event.start && (
                                    <> — {format(new Date(event.end), 'd MMMM', { locale: ru })}</>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Arrow */}
                          <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="text-center text-gray-500 py-4">Loading...</div>
        )}

        {/* Auto-sync indicator */}
        <div className="text-center text-xs text-gray-400 pt-2">
          Auto-syncs every 30 seconds
        </div>
      </div>
    </WorkerLayout>
  );
}
