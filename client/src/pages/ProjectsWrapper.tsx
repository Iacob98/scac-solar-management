import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Download, FileText, Plus, Users, Building2, Receipt, Settings, Eye, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertProjectSchema, type Project, type Client, type Crew } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import ProjectDetail from './ProjectDetail';
import Services from './Services';

interface ProjectsWrapperProps {
  selectedFirm: string;
}

type ViewMode = 'list' | 'detail' | 'services';

const projectFormSchema = insertProjectSchema.extend({
  startDate: z.string().min(1, 'Дата начала обязательна'),
  clientId: z.number().min(1, 'Выберите клиента'),
  crewId: z.number().min(1, 'Выберите бригаду'),
  installationPersonFirstName: z.string().min(1, 'Имя обязательно'),
  installationPersonLastName: z.string().min(1, 'Фамилия обязательна'),
  installationPersonAddress: z.string().min(1, 'Адрес обязателен'),
  installationPersonUniqueId: z.string().min(1, 'Уникальный ID обязателен'),
});

const statusLabels = {
  planning: 'Планируется',
  in_progress: 'В работе',
  done: 'Завершен',
  invoiced: 'Счет выставлен',
  paid: 'Оплачен'
};

const statusColors = {
  planning: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  invoiced: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-purple-100 text-purple-800'
};

function ProjectsList({ selectedFirm, onViewProject, onManageServices }: { selectedFirm: string; onViewProject: (id: number) => void; onManageServices: (id: number) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
      firmId: selectedFirm,
      leiterId: user?.id || '',
      clientId: undefined,
      crewId: undefined,
      startDate: '',
      status: 'planning' as const,
      installationPersonFirstName: '',
      installationPersonLastName: '',
      installationPersonAddress: '',
      installationPersonUniqueId: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: (data: z.infer<typeof projectFormSchema>) => {
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] });
      toast({ 
        title: 'Счет создан успешно',
        description: `Счет №${data.invoiceNumber} создан в Invoice Ninja`
      });
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
      leiterId: user?.id || data.leiterId,
      firmId: selectedFirm,
    });
  };

  const updateProjectStatus = (projectId: number, status: string) => {
    updateProjectStatusMutation.mutate({ projectId, status });
  };

  const filteredProjects = (projects as Project[]).filter((project: Project) => {
    const matchesFilter = !filter || 
      getClientName(project.clientId).toLowerCase().includes(filter.toLowerCase()) ||
      project.teamNumber?.toLowerCase().includes(filter.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesFilter && matchesStatus;
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
              <DialogDescription>
                Заполните форму для создания нового проекта установки солнечных панелей
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
                        <FormLabel>Клиент</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
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
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
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

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Информация о клиенте установки</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="installationPersonFirstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Имя</FormLabel>
                          <FormControl>
                            <Input placeholder="Имя клиента" {...field} />
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
                          <FormLabel>Фамилия</FormLabel>
                          <FormControl>
                            <Input placeholder="Фамилия клиента" {...field} />
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
                        <FormLabel>Адрес установки</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Полный адрес для установки солнечных панелей" {...field} />
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
                        <FormLabel>Уникальный ID клиента</FormLabel>
                        <FormControl>
                          <Input placeholder="Например: CLI-001234" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createProjectMutation.isPending}
                    onClick={(e) => {
                      console.log('Submit button clicked');
                      e.preventDefault();
                      form.handleSubmit(onSubmit)();
                    }}
                  >
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
          placeholder="Поиск проектов..."
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
                    
                    {project.status === 'planning' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateProjectStatus(project.id, 'in_progress')}
                      >
                        Начать работу
                      </Button>
                    )}
                    
                    {project.status === 'in_progress' && (
                      <Button 
                        size="sm" 
                        onClick={() => updateProjectStatus(project.id, 'done')}
                      >
                        Завершить
                      </Button>
                    )}
                    
                    {project.status === 'done' && (
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

export default function ProjectsWrapper({ selectedFirm }: ProjectsWrapperProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const handleViewProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setViewMode('detail');
  };

  const handleManageServices = (projectId: number) => {
    setSelectedProjectId(projectId);
    setViewMode('services');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedProjectId(null);
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