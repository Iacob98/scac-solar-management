import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertTriangle } from 'lucide-react';

const createReclamationSchema = z.object({
  description: z.string().min(10, 'Описание должно быть минимум 10 символов'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Выберите дату'),
  crewId: z.string().min(1, 'Выберите бригаду'),
});

type CreateReclamationForm = z.infer<typeof createReclamationSchema>;

interface Crew {
  id: number;
  name: string;
  uniqueNumber: string;
}

interface CreateReclamationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  firmId: number;
  currentCrewId?: number;
}

export function CreateReclamationDialog({
  open,
  onOpenChange,
  projectId,
  firmId,
  currentCrewId,
}: CreateReclamationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch crews for the firm
  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ['/api/crews', firmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/crews?firmId=${firmId}`, 'GET');
      return response.json();
    },
    enabled: open && !!firmId,
  });

  const form = useForm<CreateReclamationForm>({
    resolver: zodResolver(createReclamationSchema),
    defaultValues: {
      description: '',
      deadline: '',
      crewId: currentCrewId?.toString() || '',
    },
  });

  const createReclamationMutation = useMutation({
    mutationFn: async (data: CreateReclamationForm) => {
      const response = await apiRequest(`/api/projects/${projectId}/reclamation`, 'POST', {
        description: data.description,
        deadline: data.deadline,
        crewId: parseInt(data.crewId),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reclamations'] });
      toast({
        title: 'Рекламация создана',
        description: 'Бригада получит уведомление о необходимости исправления',
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать рекламацию',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: CreateReclamationForm) => {
    createReclamationMutation.mutate(data);
  };

  // Set default deadline to 7 days from now
  const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Создать рекламацию
          </DialogTitle>
          <DialogDescription>
            Создание рекламации означает претензию по качеству выполненной работы.
            Бригада получит уведомление и должна будет исправить проблему.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание проблемы *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Опишите подробно, что нужно исправить..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Срок исправления *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value || getDefaultDeadline()}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="crewId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Назначить бригаду *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите бригаду" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {crews.map((crew) => (
                        <SelectItem key={crew.id} value={crew.id.toString()}>
                          {crew.name} ({crew.uniqueNumber})
                          {crew.id === currentCrewId && ' - текущая'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              <strong>Внимание:</strong> После создания рекламации статус проекта изменится
              на "Рекламация". Бригада сможет принять или отклонить задание.
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createReclamationMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {createReclamationMutation.isPending
                  ? 'Создание...'
                  : 'Создать рекламацию'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
