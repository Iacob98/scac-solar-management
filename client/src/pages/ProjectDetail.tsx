import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, FileText, Users, Package, Clock, Euro, Calendar, Building2, Phone, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type Project, type Service, type Client, type Crew } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import ServicesPage from './Services';
import ProjectHistory from './ProjectHistory';
import { ProjectShareButton } from '@/components/ProjectShareButton';
import { ProjectStatusManager } from '@/components/Projects/ProjectStatusManager';

interface ProjectDetailProps {
  projectId: number;
  selectedFirm: string;
  onBack: () => void;
}

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

export default function ProjectDetail({ projectId, selectedFirm, onBack }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState('services');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      console.log('Making API request for project:', projectId);
      const response = await apiRequest(`/api/projects/${projectId}`, 'GET');
      const data = await response.json();
      console.log('Project API response:', data);
      return data;
    },
    retry: 1,
    staleTime: 0,
    cacheTime: 0,
  });

  console.log('Project state:', { project, projectLoading, projectError, projectId });
  console.log('Project data keys:', project ? Object.keys(project) : 'no project');

  const { data: services } = useQuery({
    queryKey: ['/api/services', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/services?projectId=${projectId}`, 'GET');
      return await response.json();
    },
    enabled: !!project,
  });

  const { data: client, error: clientError } = useQuery({
    queryKey: ['/api/clients/single', project?.clientId],
    queryFn: async () => {
      const response = await apiRequest(`/api/clients/single/${project.clientId}`, 'GET');
      return await response.json();
    },
    enabled: !!project?.clientId,
  });

  const { data: crew, error: crewError } = useQuery({
    queryKey: ['/api/crews/single', project?.crewId],
    queryFn: async () => {
      const response = await apiRequest(`/api/crews/single/${project.crewId}`, 'GET');
      return await response.json();
    },
    enabled: !!project?.crewId,
  });

  console.log('Related data:', { client, clientError, crew, crewError });



  const updateProjectStatusMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}`, 'PATCH', data),
    onSuccess: () => {
      // Обновляем все связанные кеши с правильными ключами
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] }); // Базовый список проектов
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedFirm] }); // Список проектов по фирме
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] }); // Детали проекта
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'history'] }); // История проекта
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



  // Улучшенная функция для обновления дат с автоматической сменой статуса
  const updateProjectDates = (updates: Partial<Project>) => {
    const updatesWithAutoStatus = { ...updates };
    
    // Автоматически меняем статус на "оборудование прибыло" если указали дату прибытия
    if (updates.equipmentArrivedDate && project.status === 'equipment_waiting') {
      updatesWithAutoStatus.status = 'equipment_arrived';
    }
    
    updateProjectStatusMutation.mutate(updatesWithAutoStatus);
  };

  if (projectLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    console.log('Project not found, loading state:', projectLoading);
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Проект не найден</h3>
          <p className="text-gray-500">Проект с указанным ID не существует или загружается</p>
          <p className="text-xs text-gray-400 mt-2">ID: {projectId}, Loading: {projectLoading ? 'да' : 'нет'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="hover:bg-blue-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к проектам
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building2 className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Проект #{project.id}</h1>
                <p className="text-gray-600 mt-1">
                  {project.installationPersonFirstName} {project.installationPersonLastName}
                </p>
              </div>
              <Badge className={`${statusColors[project.status as keyof typeof statusColors]} text-sm px-3 py-1`}>
                {statusLabels[project.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Кнопка "Поделиться" */}
              <ProjectShareButton projectId={project.id} firmId={project.firmId} />
            </div>
          </div>
        </div>

        {/* Основной контент */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Левая колонка - основная информация */}
          <div className="lg:col-span-2 space-y-6">
            {/* Информация о клиенте */}
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Информация о клиенте
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Имя клиента</p>
                    <p className="font-medium text-gray-900">{(client as Client)?.name || 'Загрузка...'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Телефон для установки</p>
                    <p className="font-medium text-gray-900 flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-green-600" />
                      {project.installationPersonPhone || 'Не указан'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Контактное лицо</p>
                    <p className="font-medium text-gray-900">
                      {project.installationPersonFirstName} {project.installationPersonLastName}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Номер команды</p>
                    <p className="font-medium text-gray-900">#{project.teamNumber}</p>
                  </div>
                </div>
                
                {project.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-1">Заметки</p>
                    <p className="text-gray-900">{project.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* История проекта */}
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center">
                    <History className="h-5 w-5 mr-2 text-green-600" />
                    История проекта
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className="text-green-600 hover:bg-green-50 text-xs px-2 py-1"
                  >
                    {showAllHistory ? 'Свернуть' : 'Показать все'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectHistory 
                  projectId={project.id} 
                  onBack={() => {}}
                  embedded={true}
                  limit={showAllHistory ? undefined : 5}
                />
              </CardContent>
            </Card>
          </div>
          
          {/* Правая колонка - боковая панель */}
          <div className="space-y-6">
            {/* Управление статусом проекта */}
            <ProjectStatusManager project={project} selectedFirm={selectedFirm} />

            {/* Временные рамки */}
            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Calendar className="h-5 w-5 mr-2 text-purple-600" />
                  Временные рамки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Дата начала</p>
                  <p className="font-medium text-gray-900">
                    {project.startDate ? 
                      format(new Date(project.startDate), 'dd.MM.yyyy', { locale: ru }) : 
                      'Не установлена'
                    }
                  </p>
                </div>
                
                {project.workEndDate && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Дата окончания работ</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(project.workEndDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Команда</p>
                  <p className="font-medium text-gray-900 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-blue-600" />
                    {(crew as Crew)?.name || 'Не назначена'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Финансовая информация */}
            {project.invoiceNumber && (
              <Card className="border-l-4 border-l-orange-500 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Euro className="h-5 w-5 mr-2 text-orange-600" />
                    Финансы
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Номер счета</p>
                    <p className="font-medium text-gray-900">#{project.invoiceNumber}</p>
                  </div>
                  
                  {project.invoiceUrl && (
                    <Button variant="outline" size="sm" asChild className="w-full">
                      <a href={project.invoiceUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Скачать счет
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Вкладки */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="services" className="text-sm">Услуги проекта</TabsTrigger>
              <TabsTrigger value="management" className="text-sm">Управление датами</TabsTrigger>
              <TabsTrigger value="files" className="text-sm">Файлы и отчеты</TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="space-y-4">
              <ServicesPage 
                projectId={project.id} 
                selectedFirm={selectedFirm}
                isEmbedded={true}
                projectStatus={project.status}
              />
            </TabsContent>

            <TabsContent value="management" className="space-y-6">
              {/* Управление датами */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Управление датами оборудования */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Package className="h-5 w-5 mr-2 text-blue-600" />
                      Оборудование
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ожидаемая дата поставки</label>
                      <Input
                        type="date"
                        value={project.equipmentExpectedDate ? 
                          new Date(project.equipmentExpectedDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateProjectDates({
                          equipmentExpectedDate: e.target.value ? new Date(e.target.value).toISOString() : null
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Фактическая дата поставки</label>
                      <Input
                        type="date"
                        value={project.equipmentArrivedDate ? 
                          new Date(project.equipmentArrivedDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateProjectDates({
                          equipmentArrivedDate: e.target.value ? new Date(e.target.value).toISOString() : null
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={project.needsCallForEquipmentDelay || false}
                        onCheckedChange={(checked) => updateProjectDates({
                          needsCallForEquipmentDelay: checked
                        })}
                      />
                      <label className="text-sm">Нужен звонок по задержке оборудования</label>
                    </div>
                  </CardContent>
                </Card>

                {/* Управление датами работ */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle className="flex items-center text-lg">
                      <Clock className="h-5 w-5 mr-2 text-green-600" />
                      Работы
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Дата начала работ</label>
                      <Input
                        type="date"
                        value={project.workStartDate ? 
                          new Date(project.workStartDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateProjectDates({
                          workStartDate: e.target.value ? new Date(e.target.value).toISOString() : null
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Дата окончания работ</label>
                      <Input
                        type="date"
                        value={project.workEndDate ? 
                          new Date(project.workEndDate).toISOString().split('T')[0] : ''}
                        onChange={(e) => updateProjectDates({
                          workEndDate: e.target.value ? new Date(e.target.value).toISOString() : null
                        })}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={project.needsCallForCrewDelay || false}
                          onCheckedChange={(checked) => updateProjectDates({
                            needsCallForCrewDelay: checked
                          })}
                        />
                        <label className="text-sm">Нужен звонок по задержке бригады</label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={project.needsCallForDateChange || false}
                          onCheckedChange={(checked) => updateProjectDates({
                            needsCallForDateChange: checked
                          })}
                        />
                        <label className="text-sm">Нужен звонок по изменению дат</label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>



            <TabsContent value="files" className="space-y-4">
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Файлы и отчеты</h3>
                <p>Функционал файлов будет добавлен позже</p>
              </div>
            </TabsContent>


          </Tabs>
        </div>
      </div>


    </div>
  );
}