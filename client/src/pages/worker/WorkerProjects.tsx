import { useQuery } from '@tanstack/react-query';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { useLocation } from 'wouter';
import {
  MapPin,
  Calendar,
  ArrowRight,
  FolderOpen,
  Filter,
  FileEdit,
  Package,
  PackageCheck,
  CalendarCheck,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Project {
  id: number;
  status: string;
  workStartDate: string | null;
  workEndDate: string | null;
  installationPersonFirstName: string | null;
  installationPersonLastName: string | null;
  installationPersonAddress: string | null;
  client: {
    name: string;
    address: string | null;
  };
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

const statusFilters = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'В работе' },
  { value: 'scheduled', label: 'Запланированные' },
  { value: 'completed', label: 'Завершённые' },
];

export default function WorkerProjects() {
  const [filter, setFilter] = useState('all');
  const [, navigate] = useLocation();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/worker/projects'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/projects', 'GET');
      return response.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const filteredProjects = projects.filter((project) => {
    switch (filter) {
      case 'active':
        return project.status === 'work_in_progress';
      case 'scheduled':
        return ['work_scheduled', 'equipment_arrived', 'equipment_waiting', 'planning'].includes(project.status);
      case 'completed':
        return project.status === 'work_completed';
      default:
        return true;
    }
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format(new Date(dateStr), 'd MMM yyyy', { locale: ru });
  };

  const getPersonName = (project: Project) => {
    const firstName = project.installationPersonFirstName || '';
    const lastName = project.installationPersonLastName || '';
    return [firstName, lastName].filter(Boolean).join(' ') || project.client?.name || 'Unknown';
  };

  return (
    <WorkerLayout title="Проекты">
      <div className="p-4 space-y-4">
        {/* Filter */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {filteredProjects.length} проект{filteredProjects.length === 1 ? '' : filteredProjects.length > 1 && filteredProjects.length < 5 ? 'а' : 'ов'}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                {statusFilters.find((f) => f.value === filter)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup value={filter} onValueChange={setFilter}>
                {statusFilters.map((f) => (
                  <DropdownMenuRadioItem key={f.value} value={f.value}>
                    {f.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Projects List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Проекты не найдены</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filter !== 'all'
                ? 'Попробуйте изменить фильтр'
                : 'Нет проектов для вашей бригады'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => {
              const config = getStatusConfig(project.status);
              const StatusIcon = config.icon;

              return (
                <Card
                  key={project.id}
                  className={cn(
                    'hover:shadow-lg transition-all cursor-pointer active:scale-[0.99] border-l-4',
                    config.dotColor.replace('bg-', 'border-')
                  )}
                  onClick={() => navigate(`/worker/projects/${project.id}`)}
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
                        <h3 className="font-semibold text-gray-900 truncate">
                          {getPersonName(project)}
                        </h3>

                        {/* Status Badge */}
                        <div className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-1',
                          config.bgColor,
                          config.textColor
                        )}>
                          <div className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
                          {config.label}
                        </div>

                        <div className="mt-2 space-y-1">
                          {(project.installationPersonAddress || project.client?.address) && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
                              <span className="truncate">
                                {project.installationPersonAddress || project.client?.address}
                              </span>
                            </div>
                          )}

                          {project.workStartDate && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
                              <span>
                                {formatDate(project.workStartDate)}
                                {project.workEndDate &&
                                  project.workEndDate !== project.workStartDate &&
                                  ` — ${formatDate(project.workEndDate)}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </WorkerLayout>
  );
}
