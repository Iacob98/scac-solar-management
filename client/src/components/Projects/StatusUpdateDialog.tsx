import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface StatusUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  targetStatus: string;
  firmId: string;
}

const statusConfig: Record<string, { title: string; description: string; fields: string[] }> = {
  equipment_waiting: {
    title: 'Ожидание оборудования',
    description: 'Укажите ожидаемую дату прибытия оборудования',
    fields: ['equipmentExpectedDate'],
  },
  equipment_arrived: {
    title: 'Оборудование прибыло',
    description: 'Подтвердите дату прибытия оборудования',
    fields: ['equipmentArrivedDate'],
  },
  work_scheduled: {
    title: 'Работа запланирована',
    description: 'Укажите ожидаемую дату начала работ',
    fields: ['workStartDate'],
  },
  work_in_progress: {
    title: 'Работа в процессе',
    description: 'Подтвердите начало работ',
    fields: [],
  },
  work_completed: {
    title: 'Работа завершена',
    description: 'Укажите дату завершения работ',
    fields: ['workEndDate'],
  },
  invoiced: {
    title: 'Выставлен счет',
    description: 'Проект переведен в статус "Выставлен счет"',
    fields: [],
  },
  paid: {
    title: 'Оплачен',
    description: 'Проект помечен как оплаченный',
    fields: [],
  },
};

export function StatusUpdateDialog({ 
  open, 
  onOpenChange, 
  project, 
  targetStatus, 
  firmId 
}: StatusUpdateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  
  // Всегда создаем schema и форму, даже если данные не готовы
  const config = statusConfig[targetStatus] || { title: 'Обновить статус', description: 'Изменить статус проекта', fields: [] };
  
  // Динамически создаем schema на основе полей конфигурации
  const schemaFields: any = { status: z.string() };
  
  if (config.fields.includes('equipmentExpectedDate')) {
    schemaFields.equipmentExpectedDate = z.string().min(1, 'Дата обязательна');
  }
  if (config.fields.includes('equipmentArrivedDate')) {
    schemaFields.equipmentArrivedDate = z.string().min(1, 'Дата обязательна');
  }
  if (config.fields.includes('workStartDate')) {
    schemaFields.workStartDate = z.string().min(1, 'Дата обязательна');
  }
  if (config.fields.includes('workEndDate')) {
    schemaFields.workEndDate = z.string().min(1, 'Дата обязательна');
  }
  
  const schema = z.object(schemaFields);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      status: targetStatus || 'planning',
      equipmentExpectedDate: '',
      equipmentArrivedDate: '',
      workStartDate: '',
      workEndDate: '',
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/projects/${project?.id}/status`, 'PATCH', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ description: 'Статус проекта обновлен' });
      // Обновляем все связанные кеши
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] }); // Список проектов
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project?.id] }); // Детали проекта
      queryClient.invalidateQueries({ queryKey: ['/api/projects', project?.id, 'history'] }); // История проекта
      onOpenChange(false);
      form.reset();
      setSelectedDate(undefined);
    },
    onError: (error: any) => {
      toast({ 
        description: error.message || 'Ошибка при обновлении статуса', 
        variant: 'destructive' 
      });
    },
  });

  const onSubmit = (data: any) => {
    if (!project) return;
    updateStatusMutation.mutate(data);
  };

  const handleDateSelect = (fieldName: string, date: Date | undefined) => {
    if (date) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      form.setValue(fieldName, formattedDate);
      setSelectedDate(date);
    }
  };

  // Не рендерим если нет данных
  if (!project || !targetStatus) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Поля с датами */}
            {config.fields.map((fieldName) => (
              <FormField
                key={fieldName}
                control={form.control}
                name={fieldName}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                      {fieldName === 'equipmentExpectedDate' && 'Ожидаемая дата прибытия оборудования'}
                      {fieldName === 'equipmentArrivedDate' && 'Дата прибытия оборудования'}
                      {fieldName === 'workStartDate' && 'Дата начала работ'}
                      {fieldName === 'workEndDate' && 'Дата завершения работ'}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value 
                              ? format(new Date(field.value), 'dd.MM.yyyy', { locale: ru })
                              : "Выберите дату"
                            }
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={(date) => handleDateSelect(fieldName, date)}
                          disabled={(date) => date < new Date("1900-01-01")}
                          initialFocus
                          locale={ru}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  form.reset();
                  setSelectedDate(undefined);
                }}
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}