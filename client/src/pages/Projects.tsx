import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Download, FileText, Plus, Users, Building2, Receipt, Settings, Eye, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertProjectSchema, type Project, type Client, type Crew } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/Layout/MainLayout';
import ProjectsWrapper from './ProjectsWrapper';
import { useProjectParams } from '@/shared/routing';

const projectFormSchema = insertProjectSchema.extend({
  startDate: z.string(),
  endDate: z.string().optional(),
});

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
  planning: 'bg-gray-100 text-gray-800',
  equipment_waiting: 'bg-orange-100 text-orange-800',
  equipment_arrived: 'bg-blue-100 text-blue-800',
  work_scheduled: 'bg-purple-100 text-purple-800',
  work_in_progress: 'bg-yellow-100 text-yellow-800',
  work_completed: 'bg-green-100 text-green-800',
  invoiced: 'bg-indigo-100 text-indigo-800',
  paid: 'bg-emerald-100 text-emerald-800'
};

interface ProjectsProps {
  selectedFirm: string;
  onViewProject?: (projectId: number) => void;
  onManageServices?: (projectId: number) => void;
}

function ProjectsList({ selectedFirm, onViewProject, onManageServices }: ProjectsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects', selectedFirm],
    enabled: !!selectedFirm,
    refetchInterval: 30000, // Автообновление каждые 30 секунд
  });

  // Добавляем логирование загруженных проектов
  console.log('📊 Загружено проектов:', projects.length);
  console.log('📋 Данные проектов:', projects);

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
      firmId: selectedFirm,
      leiterId: user?.id || '',
      clientId: 0,
      crewId: 0,
      startDate: '',
      endDate: '',
      status: 'planning' as const,
      teamNumber: '',
      notes: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/projects', 'POST', {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      toast({ title: 'Проект создан успешно' });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось создать проект',
        variant: 'destructive' 
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (projectId: number) => apiRequest('/api/invoice/create', 'POST', { projectId }),
    onSuccess: (data: any) => {
      // Обновляем кэш проектов и счетов после создания нового счета
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices', selectedFirm] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ 
        title: 'Счет выставлен', 
        description: `Счет №${data.invoiceNumber} создан успешно` 
      });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Ошибка выставления счета', 
        description: error.message || 'Не удалось выставить счет',
        variant: 'destructive' 
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceNumber: string) => apiRequest('/api/invoice/mark-paid', 'PATCH', { invoiceNumber }),
    onSuccess: () => {
      // Принудительно обновляем все кэши для пересчета статистики
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.refetchQueries({ queryKey: ['/api/invoices', selectedFirm] });
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

  const onSubmit = (data: z.infer<typeof projectFormSchema>) => {
    createProjectMutation.mutate({
      ...data,
      leiterId: user?.id || data.leiterId,
      firmId: selectedFirm,
    });
  };

  const updateProjectStatus = (projectId: number, status: string) => {
    updateProjectStatusMutation.mutate({ projectId, status });
  };

  console.log('🔍 Начинаем фильтрацию. Фильтр:', filter, 'Статус фильтр:', statusFilter);
  
  const filteredProjects = (projects as Project[]).filter((project: Project & { client?: Client; crew?: Crew }) => {
    const clientName = getClientName(project.clientId);
    const searchTerm = filter.toLowerCase();
    
    // Добавляем логирование для отладки
    if (filter) {
      console.log('🔍 Поиск:', filter);
      console.log('📋 Проект ID:', project.id);
      console.log('🆔 Уникальный ID:', project.installationPersonUniqueId);
      console.log('👤 Имя клиента:', clientName);
      console.log('📝 Заметки:', project.notes);
      console.log('🔢 Номер бригады:', project.teamNumber);
    }
    
    const matchesSearch = !filter || 
      (project.notes && project.notes.toLowerCase().includes(searchTerm)) ||
      (clientName && clientName.toLowerCase().includes(searchTerm)) ||
      (project.teamNumber && project.teamNumber.toLowerCase().includes(searchTerm)) ||
      (project.installationPersonUniqueId && project.installationPersonUniqueId.toLowerCase().includes(searchTerm));
    
    if (filter) {
      console.log('✅ Результат поиска для проекта', project.id, ':', matchesSearch);
    }
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: number) => {
    const client = (clients as Client[]).find((c: Client) => c.id === clientId);
    return client?.name || 'Неизвестный клиент';
  };

  const getCrewName = (crewId: number) => {
    const crew = (crews as Crew[]).find((c: Crew) => c.id === crewId);
    return crew?.name || 'Не назначена';
  };

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
          <h1 className="text-2xl font-bold">Проекты</h1>
          <p className="text-gray-600">Управление проектами установки солнечных панелей</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Создать проект
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создание нового проекта</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Клиент</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите клиента" />
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
                        <FormLabel>Бригада</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите бригаду" />
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
                        <FormLabel>Дата начала</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата окончания</FormLabel>
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
                  name="teamNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Номер команды</FormLabel>
                      <FormControl>
                        <Input placeholder="Например: Команда-1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание проекта</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Дополнительная информация о проекте" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Создание...' : 'Создать проект'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex space-x-4">
        <Input
          placeholder="Поиск по имени клиента, заметкам, уникальному номеру..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <CardTitle className="text-lg">{getClientName(project.clientId)}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
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
                
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onViewProject?.(project.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Просмотр
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onManageServices?.(project.id)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Услуги
                    </Button>
                    
                    {project.status === 'planning' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateProjectStatus(project.id, 'work_in_progress')}
                      >
                        Начать работу
                      </Button>
                    )}
                    
                    {project.status === 'work_in_progress' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateProjectStatus(project.id, 'work_completed')}
                      >
                        Завершить
                      </Button>
                    )}
                    
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

export default function Projects() {
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const { projectId } = useProjectParams();

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  return (
    <MainLayout>
      <div className="p-6">
        <ProjectsWrapper selectedFirm={selectedFirmId} initialProjectId={projectId} />
      </div>
    </MainLayout>
  );
}