import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Download, FileText, Plus, Users, Building2, Receipt, Settings, Eye, ArrowLeft, Sun, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertProjectSchema, type Project, type Client, type Crew } from '@shared/schema';
import Tutorial from '@/components/Tutorial';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useTranslations } from '@/hooks/useTranslations';

import ProjectDetail from './ProjectDetail';
import Services from './Services';

interface ProjectsWrapperProps {
  selectedFirm: string;
  initialProjectId?: number | null;
}

type ViewMode = 'list' | 'detail' | 'services';

const projectFormSchema = insertProjectSchema.omit({ id: true, firmId: true, leiterId: true, createdAt: true, updatedAt: true }).extend({
  startDate: z.string().min(1, 'Дата начала обязательна'),
  equipmentExpectedDate: z.string().min(1, 'Ожидаемая дата поставки обязательна'),
  workStartDate: z.string().optional(),
  clientId: z.number().min(1, 'Выберите клиента'),
  crewId: z.number().optional(),
  installationPersonFirstName: z.string().min(1, 'Имя обязательно'),
  installationPersonLastName: z.string().min(1, 'Фамилия обязательна'),
  installationPersonAddress: z.string().min(1, 'Адрес обязателен'),
  installationPersonPhone: z.string().min(1, 'Телефон обязателен'),
  installationPersonUniqueId: z.string().min(1, 'Уникальный ID обязателен'),
});

// Функция для получения переводов статусов
const getStatusLabels = (t: (key: string, fallback: string) => string) => ({
  planning: t('планирование', 'Планирование'),
  equipment_waiting: t('ожидание_оборудования', 'Ожидание оборудования'),
  equipment_arrived: t('оборудование_поступило', 'Оборудование поступило'),
  work_scheduled: t('работы_запланированы', 'Работы запланированы'),
  work_in_progress: t('работы_в_процессе', 'Работы в процессе'),
  work_completed: t('работы_завершены', 'Работы завершены'),
  invoiced: t('счет_выставлен', 'Счет выставлен'),
  paid: t('оплачен', 'Оплачен')
});

const statusColors = {
  planning: 'bg-gray-100 text-gray-800',
  equipment_waiting: 'bg-orange-100 text-orange-800',
  equipment_arrived: 'bg-blue-100 text-blue-800',
  work_scheduled: 'bg-cyan-100 text-cyan-800',
  work_in_progress: 'bg-yellow-100 text-yellow-800',
  work_completed: 'bg-green-100 text-green-800',
  invoiced: 'bg-purple-100 text-purple-800',
  paid: 'bg-emerald-100 text-emerald-800'
};

function ProjectsList({ selectedFirm, onViewProject, onManageServices }: { selectedFirm: string; onViewProject: (id: number) => void; onManageServices: (id: number) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslations();
  const statusLabels = getStatusLabels(t);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);


  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects', selectedFirm],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?firmId=${selectedFirm}`, 'GET');
      return await response.json();
    },
    enabled: !!selectedFirm,
    refetchInterval: 30000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', selectedFirm],
    queryFn: async () => {
      const response = await apiRequest(`/api/clients?firmId=${selectedFirm}`, 'GET');
      return await response.json();
    },
    enabled: !!selectedFirm,
    refetchInterval: 30000,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', selectedFirm],
    queryFn: async () => {
      const response = await apiRequest(`/api/crews?firmId=${selectedFirm}`, 'GET');
      return await response.json();
    },
    enabled: !!selectedFirm,
    refetchInterval: 30000,
  });

  const form = useForm({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      clientId: 0,
      crewId: 0,
      startDate: '',
      equipmentExpectedDate: '',
      workStartDate: '',
      status: 'planning' as const,
      installationPersonFirstName: '',
      installationPersonLastName: '',
      installationPersonAddress: '',
      installationPersonPhone: '',
      installationPersonUniqueId: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: z.infer<typeof projectFormSchema> & { firmId: string; leiterId: string }) => {
      console.log('Sending data to API:', data);
      return apiRequest('/api/projects', 'POST', data);
    },
    onSuccess: () => {
      console.log('Project created successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Проект создан',
        description: 'Новый проект успешно добавлен в систему',
      });
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      toast({
        title: 'Ошибка создания проекта',
        description: error.message || 'Не удалось создать проект',
        variant: 'destructive',
      });
    },
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: number; status: string }) => 
      apiRequest(`/api/projects/${projectId}/status`, 'PATCH', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      toast({ title: 'Статус проекта обновлен' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить статус проекта',
        variant: 'destructive'
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (projectId: number) => apiRequest('/api/invoice/create', 'POST', { projectId }),
    onSuccess: async (data: any, projectId: number) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      toast({ 
        title: 'Счет создан успешно',
        description: `Счет №${data.invoiceNumber} создан в Invoice Ninja`
      });
      
      // Автоматически скачиваем PDF
      try {
        await apiRequest(`/api/invoice/download-pdf/${projectId}`, 'POST');
        queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
        toast({ 
          title: 'PDF скачан',
          description: 'PDF счета добавлен в файлы проекта'
        });
      } catch (error: any) {
        console.error('Failed to download PDF:', error);
        toast({
          title: 'Предупреждение',
          description: 'Счет создан, но не удалось скачать PDF автоматически',
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать счет',
        variant: 'destructive'
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceNumber: string) => apiRequest('/api/invoice/mark-paid', 'PATCH', { invoiceNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      toast({ title: 'Счет отмечен как оплаченный' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отметить счет как оплаченный',
        variant: 'destructive'
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof projectFormSchema>) => {
    console.log('Form submission started');
    console.log('Form data:', data);
    console.log('Form errors:', form.formState.errors);
    console.log('Form is valid:', form.formState.isValid);
    
    // Принудительная валидация
    const isValid = await form.trigger();
    console.log('Manual validation result:', isValid);
    
    if (!isValid) {
      console.log('Form validation failed');
      console.log('All errors:', form.formState.errors);
      return;
    }
    
    console.log('Submitting project data...');
    createProjectMutation.mutate({
      ...data,
      leiterId: user?.id || '',
      firmId: selectedFirm,
      crewId: data.crewId || null,
    });
  };

  const updateProjectStatus = (projectId: number, status: string) => {
    updateProjectStatusMutation.mutate({ projectId, status });
  };

  const getClientName = (clientId: number) => {
    const client = (clients as Client[]).find((c: Client) => c.id === clientId);
    return client?.name || t('неизвестный_клиент', 'Неизвестный клиент');
  };

  const getInstallationPersonName = (project: Project) => {
    if (project.installationPersonFirstName && project.installationPersonLastName) {
      return `${project.installationPersonFirstName} ${project.installationPersonLastName}`;
    }
    if (project.installationPersonFirstName) {
      return project.installationPersonFirstName;
    }
    if (project.installationPersonLastName) {
      return project.installationPersonLastName;
    }
    return t('не_указан_клиент_установки', 'Не указан клиент установки');
  };

  const getCrewName = (crewId: number | null) => {
    if (!crewId) return t('не_назначена', 'Не назначена');
    const crew = (crews as Crew[]).find((c: Crew) => c.id === crewId);
    return crew?.name || t('не_назначена', 'Не назначена');
  };

  const getCrewUniqueNumber = (crewId: number | null) => {
    if (!crewId) return '';
    const crew = (crews as Crew[]).find((c: Crew) => c.id === crewId);
    return crew?.uniqueNumber || '';
  };

  const filteredProjects = (projects as Project[]).filter((project: Project) => {
    // Скрытие завершенных проектов (отправлен счет или оплачен)
    if (hideCompleted && (project.status === 'invoiced' || project.status === 'paid' || project.status === 'invoice_sent')) {
      return false;
    }
    
    const matchesFilter = !filter || 
      getInstallationPersonName(project).toLowerCase().includes(filter.toLowerCase()) ||
      getClientName(project.clientId).toLowerCase().includes(filter.toLowerCase()) ||
      getCrewUniqueNumber(project.crewId).toLowerCase().includes(filter.toLowerCase()) ||
      project.installationPersonUniqueId?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesFilter && matchesStatus;
  }).sort((a, b) => {
    // Сортировка по приоритету дат
    const now = new Date();
    
    // Функция для получения приоритета проекта (меньше = выше приоритет)
    const getPriority = (project: Project) => {
      // Если ожидается оборудование и дата близко
      if (project.status === 'equipment_waiting' && project.equipmentExpectedDate) {
        const equipmentDate = new Date(project.equipmentExpectedDate);
        const diffDays = Math.ceil((equipmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3) return 1; // Высокий приоритет если 3 дня или меньше
        if (diffDays <= 7) return 2; // Средний приоритет если неделя или меньше
      }
      
      // Если работы запланированы и дата близко
      if (project.status === 'work_scheduled' && project.workStartDate) {
        const workDate = new Date(project.workStartDate);
        const diffDays = Math.ceil((workDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) return 1; // Высокий приоритет если завтра или сегодня
        if (diffDays <= 3) return 2; // Средний приоритет если 3 дня или меньше
      }
      
      // Если нужны звонки - высокий приоритет
      if (project.needsCallForEquipmentDelay || project.needsCallForCrewDelay || project.needsCallForDateChange) {
        return 1;
      }
      
      return 10; // Низкий приоритет
    };
    
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Если приоритеты равны, сортируем по дате создания (новые первые)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  if (!selectedFirm) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Выберите фирму</h3>
          <p className="text-gray-500">Для просмотра проектов необходимо выбрать фирму</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('проекты', 'Проекты')}</h1>
          <p className="text-gray-600">{t('управление_проектами_установки_солнечных_панелей', 'Управление проектами установки солнечных панелей')}</p>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setIsTutorialOpen(true)}>
            <Sun className="h-4 w-4 mr-2" />
{t('руководство', 'Руководство')}
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
{t('создать_проект', 'Создать проект')}
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('создание_нового_проекта', 'Создание нового проекта')}</DialogTitle>
              <DialogDescription>
                {t('заполните_форму_создания_проекта', 'Заполните форму для создания нового проекта установки солнечных панелей')}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('клиент', 'Клиент')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('выберите_клиента', 'Выберите клиента')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(clients as Client[]).map((client: Client) => (
                              <SelectItem key={client.id} value={client.id.toString()}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="crewId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('бригада', 'Бригада')}</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('выберите_бригаду', 'Выберите бригаду')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(crews as Crew[]).map((crew: Crew) => (
                              <SelectItem key={crew.id} value={crew.id.toString()}>
                                {crew.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('дата_начала_проекта', 'Дата начала проекта')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="equipmentExpectedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ожидаемая_дата_поставки_оборудования', 'Ожидаемая дата поставки оборудования')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="workStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('ожидаемая_дата_начала_работ', 'Ожидаемая дата начала работ')} ({t('необязательно', 'необязательно')})</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">{t('информация_о_клиенте_установки', 'Информация о клиенте установки')}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="installationPersonFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('имя', 'Имя')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('имя_клиента', 'Имя клиента')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="installationPersonLastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('фамилия', 'Фамилия')}</FormLabel>
                          <FormControl>
                            <Input placeholder={t('фамилия_клиента', 'Фамилия клиента')} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="installationPersonAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('адрес_установки', 'Адрес установки')}</FormLabel>
                        <FormControl>
                          <Textarea placeholder={t('полный_адрес_для_установки', 'Полный адрес для установки солнечных панелей')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installationPersonPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('телефон_клиента', 'Телефон клиента')}</FormLabel>
                        <FormControl>
                          <Input placeholder="+49 123 456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="installationPersonUniqueId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('уникальный_id_клиента', 'Уникальный ID клиента')}</FormLabel>
                        <FormControl>
                          <Input placeholder={t('например_cli_001234', 'Например: CLI-001234')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    {t('отмена_диалога', 'Отмена')}
                  </Button>
                  <Button 
                    type="button" 
                    disabled={createProjectMutation.isPending}
                    onClick={async () => {
                      console.log('Submit button clicked');
                      
                      // Получаем данные формы напрямую
                      const formData = {
                        ...form.getValues(),
                        firmId: selectedFirm,
                        leiterId: user?.id || '',
                      };
                      console.log('Form data:', formData);
                      
                      // Проверяем валидность
                      const isValid = await form.trigger();
                      console.log('Form is valid:', isValid);
                      console.log('Form errors:', form.formState.errors);
                      
                      if (!isValid) {
                        console.log('Form validation failed');
                        return;
                      }
                      
                      // Вызываем функцию отправки
                      await onSubmit(formData);
                    }}
                  >
                    {createProjectMutation.isPending ? t('создание_проекта', 'Создание...') : t('создать_проект', 'Создать проект')}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
        
        <Tutorial 
          isOpen={isTutorialOpen} 
          onClose={() => setIsTutorialOpen(false)}
          onComplete={() => {
            setIsTutorialOpen(false);
            toast({
              title: 'Руководство завершено',
              description: 'Теперь вы готовы к работе с системой!',
            });
          }}
        />
      </div>

      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
        <Input
          placeholder={t('поиск_проектов', 'Поиск проектов...')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('все_статусы', 'Все статусы')}</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch
            id="hide-completed"
            checked={hideCompleted}
            onCheckedChange={setHideCompleted}
          />
          <Label htmlFor="hide-completed" className="text-sm text-gray-600">
{t('скрыть_завершенные', 'Скрыть завершенные')}
          </Label>
        </div>
      </div>

      {projectsLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProjects.map((project: Project) => (
            <Card key={project.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{getInstallationPersonName(project)}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center">
                        <Building2 className="h-4 w-4 mr-1" />
                        {getClientName(project.clientId)}
                      </span>
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {getCrewName(project.crewId || 0)}
                      </span>
                      <span>#{project.teamNumber}</span>
                      {project.startDate && (
                        <span className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          {format(new Date(project.startDate), 'dd.MM.yyyy', { locale: ru })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                    {statusLabels[project.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {project.notes && (
                  <p className="text-gray-600 mb-4">{project.notes}</p>
                )}
                
                {/* Показываем индикаторы приоритета */}
                {(() => {
                  const now = new Date();
                  let priorityIndicator = null;
                  
                  if (project.status === 'equipment_waiting' && project.equipmentExpectedDate) {
                    const equipmentDate = new Date(project.equipmentExpectedDate);
                    const diffDays = Math.ceil((equipmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 3) {
                      priorityIndicator = (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-700 font-medium">
                            ⚠️ Оборудование ожидается: {format(equipmentDate, 'dd.MM.yyyy', { locale: ru })}
                            {diffDays <= 0 ? ' (просрочено)' : ` (${diffDays} дн.)`}
                          </p>
                        </div>
                      );
                    }
                  }
                  
                  if (project.status === 'work_scheduled' && project.workStartDate) {
                    const workDate = new Date(project.workStartDate);
                    const diffDays = Math.ceil((workDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 1) {
                      priorityIndicator = (
                        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <p className="text-sm text-yellow-700 font-medium">
                            🚧 Работы начинаются: {format(workDate, 'dd.MM.yyyy', { locale: ru })}
                            {diffDays <= 0 ? ' (сегодня/просрочено)' : ' (завтра)'}
                          </p>
                        </div>
                      );
                    }
                  }
                  
                  if (project.needsCallForEquipmentDelay || project.needsCallForCrewDelay || project.needsCallForDateChange) {
                    priorityIndicator = (
                      <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded-md">
                        <p className="text-sm text-orange-700 font-medium">
                          📞 Требуется звонок клиенту
                        </p>
                      </div>
                    );
                  }
                  
                  return priorityIndicator;
                })()}
                
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onViewProject(project.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Просмотр
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onManageServices(project.id)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Услуги
                    </Button>
                    

                    
                    {/* Кнопки для счетов - оставляем только функции выставления и загрузки */}
                    {project.status === 'work_completed' && (
                      <Button 
                        size="sm" 
                        onClick={() => createInvoiceMutation.mutate(project.id)}
                        disabled={createInvoiceMutation.isPending}
                      >
                        <Receipt className="h-4 w-4 mr-2" />
                        {createInvoiceMutation.isPending ? 'Выставление...' : 'Выставить счет'}
                      </Button>
                    )}
                    
                    {project.status === 'invoiced' && project.invoiceNumber && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => markPaidMutation.mutate(project.invoiceNumber!)}
                          disabled={markPaidMutation.isPending}
                        >
                          Отметить оплаченным
                        </Button>
                        {project.invoiceUrl && (
                          <Button size="sm" variant="outline" asChild>
                            <a href={project.invoiceUrl} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Скачать PDF
                            </a>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  
                  {project.invoiceNumber && (
                    <div className="flex items-center text-sm text-gray-500">
                      <FileText className="h-4 w-4 mr-1" />
                      Счет №{project.invoiceNumber}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredProjects.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Проекты не найдены</h3>
              <p className="text-gray-500">Создайте новый проект или измените фильтры поиска</p>
            </div>
          )}
        </div>
      )}


    </div>
  );
}

export default function ProjectsWrapper({ selectedFirm, initialProjectId }: ProjectsWrapperProps) {
  const { t } = useTranslations();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  // Handle URL-based project selection and localStorage fallback
  useEffect(() => {
    if (initialProjectId) {
      // URL has project ID, use it directly
      setSelectedProjectId(initialProjectId);
      setViewMode('detail');
    } else {
      // Check localStorage for backward compatibility (calendar navigation)
      const savedProjectId = localStorage.getItem('selectedProjectId');
      if (savedProjectId) {
        const projectId = parseInt(savedProjectId);
        setSelectedProjectId(projectId);
        setViewMode('detail');
        // Clear localStorage after use
        localStorage.removeItem('selectedProjectId');
      }
    }
  }, [initialProjectId]);

  const [, setLocation] = useLocation();

  const handleViewProject = (projectId: number) => {
    // Use URL routing instead of internal state
    setLocation(`/projects/${projectId}`);
  };

  const handleManageServices = (projectId: number) => {
    setSelectedProjectId(projectId);
    setViewMode('services');
  };



  const handleBackToList = () => {
    // Navigate back to projects list using URL routing
    setLocation('/projects');
  };

  if (viewMode === 'detail' && selectedProjectId) {
    return (
      <ProjectDetail
        projectId={selectedProjectId}
        selectedFirm={selectedFirm}
        onBack={handleBackToList}
      />
    );
  }

  if (viewMode === 'services' && selectedProjectId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад к проектам
            </Button>
            <h1 className="text-2xl font-bold">Управление услугами</h1>
          </div>
        </div>
        <Services selectedFirm={selectedFirm} projectId={selectedProjectId} />
      </div>
    );
  }

  return (
    <ProjectsList
      selectedFirm={selectedFirm}
      onViewProject={handleViewProject}
      onManageServices={handleManageServices}
    />
  );
}