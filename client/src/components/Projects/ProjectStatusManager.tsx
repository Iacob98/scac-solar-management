import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Package, PlayCircle, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { format, isAfter, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels = {
  planning: 'Планирование',
  equipment_waiting: 'Ожидание оборудования',
  equipment_arrived: 'Оборудование поступило',
  work_scheduled: 'Работы запланированы',
  work_in_progress: 'Работы в процессе',
  work_completed: 'Работы завершены',
  invoiced: 'Счет выставлен',
  paid: 'Оплачен'
};

const statusColors = {
  planning: 'bg-blue-100 text-blue-800',
  equipment_waiting: 'bg-yellow-100 text-yellow-800',
  equipment_arrived: 'bg-green-100 text-green-800',
  work_scheduled: 'bg-purple-100 text-purple-800',
  work_in_progress: 'bg-orange-100 text-orange-800',
  work_completed: 'bg-emerald-100 text-emerald-800',
  invoiced: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-gray-100 text-gray-800'
};

interface ProjectStatusManagerProps {
  project: any;
  selectedFirm: string;
}

export function ProjectStatusManager({ project, selectedFirm }: ProjectStatusManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const response = await apiRequest(`/api/projects/${project.id}`, 'PATCH', { status: newStatus });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'history'] });
      toast({ description: 'Статус проекта обновлен' });
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || 'Ошибка при обновлении статуса',
        variant: 'destructive'
      });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/invoice/create', 'POST', { projectId: project.id });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ 
        description: `Счет №${data.invoiceNumber} создан в Invoice Ninja`
      });
    },
    onError: (error: any) => {
      toast({
        description: error.message || 'Не удалось создать счет',
        variant: 'destructive'
      });
    }
  });

  // Проверяем возможность автоматического перехода статуса
  const getAutoStatusSuggestion = () => {
    const today = new Date();
    
    // Если есть дата прибытия оборудования и статус "ожидание оборудования" -> предложить "оборудование прибыло"
    if (project.status === 'equipment_waiting' && project.equipmentArrivedDate) {
      const arrivedDate = new Date(project.equipmentArrivedDate);
      if (arrivedDate <= today) {
        return {
          newStatus: 'equipment_arrived',
          message: 'Оборудование должно было прибыть. Подтвердить получение?',
          action: 'Подтвердить получение оборудования'
        };
      }
    }

    // Если есть дата начала работ и оборудование прибыло -> предложить "работы запланированы"  
    if (project.status === 'equipment_arrived' && project.workStartDate) {
      return {
        newStatus: 'work_scheduled',
        message: 'Запланировать начало работ?',
        action: 'Запланировать работы'
      };
    }

    // Если дата начала работ наступила -> предложить "работы в процессе"
    if (project.status === 'work_scheduled' && project.workStartDate) {
      const workStartDate = new Date(project.workStartDate);
      if (workStartDate <= today) {
        return {
          newStatus: 'work_in_progress', 
          message: 'Пора начинать работы. Подтвердить начало?',
          action: 'Начать работы'
        };
      }
    }

    return null;
  };

  const autoSuggestion = getAutoStatusSuggestion();

  const canCreateInvoice = project.status === 'work_completed' && !project.invoiceNumber;

  return (
    <Card className="border-l-4 border-l-blue-500 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
            Управление статусом
          </div>
          <Badge className={`${statusColors[project.status as keyof typeof statusColors]} text-sm px-3 py-1`}>
            {statusLabels[project.status as keyof typeof statusLabels]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Автоматические предложения */}
        {autoSuggestion && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-800 mb-2">{autoSuggestion.message}</p>
                <Button
                  size="sm"
                  onClick={() => updateStatusMutation.mutate(autoSuggestion.newStatus)}
                  disabled={updateStatusMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {updateStatusMutation.isPending ? 'Обновление...' : autoSuggestion.action}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Ручные переходы статусов */}
        <div className="space-y-2">
          {project.status === 'planning' && (
            <Button
              onClick={() => updateStatusMutation.mutate('equipment_waiting')}
              disabled={updateStatusMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Package className="h-4 w-4 mr-2" />
              Ожидать оборудование
            </Button>
          )}

          {project.status === 'work_in_progress' && (
            <Button
              onClick={() => updateStatusMutation.mutate('work_completed')}
              disabled={updateStatusMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Завершить работы
            </Button>
          )}

          {canCreateInvoice && (
            <Button
              onClick={() => createInvoiceMutation.mutate()}
              disabled={createInvoiceMutation.isPending}
              className="w-full bg-orange-600 hover:bg-orange-700"
            >
              <Receipt className="h-4 w-4 mr-2" />
              {createInvoiceMutation.isPending ? 'Создание...' : 'Выставить счет'}
            </Button>
          )}
        </div>

        {/* Информация о датах */}
        <div className="pt-2 border-t space-y-2 text-sm text-gray-600">
          {project.equipmentExpectedDate && (
            <div className="flex justify-between">
              <span>Ожидаемая поставка:</span>
              <span>{format(new Date(project.equipmentExpectedDate), 'dd.MM.yyyy', { locale: ru })}</span>
            </div>
          )}
          {project.equipmentArrivedDate && (
            <div className="flex justify-between">
              <span>Фактическая поставка:</span>
              <span>{format(new Date(project.equipmentArrivedDate), 'dd.MM.yyyy', { locale: ru })}</span>
            </div>
          )}
          {project.workStartDate && (
            <div className="flex justify-between">
              <span>Начало работ:</span>
              <span>{format(new Date(project.workStartDate), 'dd.MM.yyyy', { locale: ru })}</span>
            </div>
          )}
          {project.workEndDate && (
            <div className="flex justify-between">
              <span>Окончание работ:</span>
              <span>{format(new Date(project.workEndDate), 'dd.MM.yyyy', { locale: ru })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}