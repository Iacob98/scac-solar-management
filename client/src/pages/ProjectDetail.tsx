import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Settings, FileText, Users, CalendarIcon, Package, Plus, Receipt, MapPin, Clock, Euro, Calendar, Building2, PlayCircle, DollarSign, CheckCircle, AlertTriangle, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type Project, type Service, type Client, type Crew } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import ServicesPage from './Services';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: () => apiRequest(`/api/projects/${projectId}`, 'GET'),
  });

  const { data: services } = useQuery({
    queryKey: ['/api/services', projectId],
    queryFn: () => apiRequest(`/api/services?projectId=${projectId}`, 'GET'),
    enabled: !!project,
  });

  const { data: client } = useQuery({
    queryKey: ['/api/clients/single', project?.clientId],
    queryFn: () => apiRequest(`/api/clients/single/${project.clientId}`, 'GET'),
    enabled: !!project?.clientId,
  });

  const { data: crew } = useQuery({
    queryKey: ['/api/crews/single', project?.crewId],
    queryFn: () => apiRequest(`/api/crews/single/${project.crewId}`, 'GET'),
    enabled: !!project?.crewId,
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
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

  const updateProjectStatus = (newStatus: string) => {
    updateProjectStatusMutation.mutate({ 
      status: newStatus 
    });
  };

  const updateProjectDates = (updates: Partial<Project>) => {
    updateProjectStatusMutation.mutate(updates);
  };

  if (projectLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Проект не найден</h3>
          <p className="text-gray-500">Проект с указанным ID не существует</p>
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
              {/* Кнопки управления статусом */}
              {project.status === 'planning' && (
                <Button 
                  onClick={() => updateProjectStatus('equipment_waiting')}
                  disabled={updateProjectStatusMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Ожидать оборудование
                </Button>
              )}
              
              {project.status === 'equipment_waiting' && project.equipmentArrivedDate && (
                <Button 
                  onClick={() => updateProjectStatus('work_scheduled')}
                  disabled={updateProjectStatusMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Запланировать работы
                </Button>
              )}
              
              {project.status === 'work_scheduled' && (
                <Button 
                  onClick={() => updateProjectStatus('work_in_progress')}
                  disabled={updateProjectStatusMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Начать работы
                </Button>
              )}
              
              {project.status === 'work_in_progress' && (
                <Button 
                  onClick={() => updateProjectStatus('work_completed')}
                  disabled={updateProjectStatusMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Завершить работы
                </Button>
              )}
              
              {project.status === 'work_completed' && !project.invoiceNumber && (
                <Button 
                  onClick={() => createInvoiceMutation.mutate(project.id)}
                  disabled={createInvoiceMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  {createInvoiceMutation.isPending ? 'Создание...' : 'Выставить счет'}
                </Button>
              )}
              
              {project.invoiceNumber && project.status === 'invoiced' && (
                <Button 
                  onClick={() => markPaidMutation.mutate(project.invoiceNumber!)}
                  disabled={markPaidMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {markPaidMutation.isPending ? 'Обновление...' : 'Отметить оплаченным'}
                </Button>
              )}
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
                      {project.installationPhone || 'Не указан'}
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

            {/* Управление проектом */}
            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Settings className="h-5 w-5 mr-2 text-green-600" />
                  Управление проектом
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">Оборудование ожидается</p>
                      <p className="text-sm text-blue-700">
                        {project.equipmentExpectedDate ? 
                          format(new Date(project.equipmentExpectedDate), 'dd.MM.yyyy', { locale: ru }) : 
                          'Дата не установлена'
                        }
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-blue-600" />
                  </div>
                  
                  {project.equipmentArrivedDate && (
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium text-green-900">Оборудование поступило</p>
                        <p className="text-sm text-green-700">
                          {format(new Date(project.equipmentArrivedDate), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  )}
                  
                  {project.workStartDate && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="font-medium text-yellow-900">Работы начинаются</p>
                        <p className="text-sm text-yellow-700">
                          {format(new Date(project.workStartDate), 'dd.MM.yyyy', { locale: ru })}
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-yellow-600" />
                    </div>
                  )}
                  
                  {(project.needsCallForEquipmentDelay || project.needsCallForCrewDelay || project.needsCallForDateChange) && (
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <p className="font-medium text-red-900">Требуется звонок клиенту</p>
                        <p className="text-sm text-red-700">Обсудить изменения в проекте</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-red-600" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Правая колонка - боковая панель */}
          <div className="space-y-6">
            {/* Статус и быстрые действия */}
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

            <TabsContent value="management" className="space-y-4">
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