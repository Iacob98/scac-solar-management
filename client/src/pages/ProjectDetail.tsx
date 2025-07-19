import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Edit, Settings, FileText, Users, CalendarIcon, Package, Plus, Receipt, MapPin, Clock, Euro } from 'lucide-react';
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
  'planning': 'Планирование',
  'in_progress': 'В процессе',
  'done': 'Выполнено', 
  'invoiced': 'Счет выставлен',
  'paid': 'Оплачено'
};

const statusColors = {
  'planning': 'bg-blue-100 text-blue-800',
  'in_progress': 'bg-yellow-100 text-yellow-800',
  'done': 'bg-green-100 text-green-800',
  'invoiced': 'bg-purple-100 text-purple-800',
  'paid': 'bg-emerald-100 text-emerald-800'
};

export default function ProjectDetail({ projectId, selectedFirm, onBack }: ProjectDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}`, 'GET');
      return await response.json();
    },
    enabled: !!projectId,
  });

  const { data: client } = useQuery({
    queryKey: ['/api/clients', project?.clientId],
    queryFn: async () => {
      const response = await apiRequest(`/api/clients/single/${project?.clientId}`, 'GET');
      return await response.json();
    },
    enabled: !!project?.clientId,
  });

  const { data: crew } = useQuery({
    queryKey: ['/api/crews', project?.crewId],
    queryFn: async () => {
      const response = await apiRequest(`/api/crews/single/${project?.crewId}`, 'GET');
      return await response.json();
    },
    enabled: !!project?.crewId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['/api/services', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/services?projectId=${projectId}`, 'GET');
      return await response.json();
    },
    enabled: !!projectId,
  });

  const updateProjectStatusMutation = useMutation({
    mutationFn: ({ projectId, status }: { projectId: number; status: string }) => 
      apiRequest(`/api/projects/${projectId}/status`, 'PATCH', { status }),
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

  const updateProjectStatus = (status: string) => {
    updateProjectStatusMutation.mutate({ projectId, status });
  };

  const totalAmount = (services as Service[]).reduce((sum, service) => {
    return sum + (parseFloat(service.price.toString()) * parseFloat(service.quantity.toString()));
  }, 0);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к проектам
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{(client as Client)?.name || 'Загрузка...'}</h1>
            <p className="text-gray-600">Детали проекта #{project.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={statusColors[project.status as keyof typeof statusColors]}>
            {statusLabels[project.status as keyof typeof statusLabels]}
          </Badge>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Редактировать
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {project.status === 'planning' && (
          <Button onClick={() => updateProjectStatus('in_progress')}>
            Начать работу
          </Button>
        )}
        
        {project.status === 'in_progress' && (
          <Button onClick={() => updateProjectStatus('done')}>
            Завершить проект
          </Button>
        )}
        
        {project.status === 'done' && (
          <Button 
            onClick={() => createInvoiceMutation.mutate(project.id)}
            disabled={createInvoiceMutation.isPending}
          >
            <Receipt className="h-4 w-4 mr-2" />
            {createInvoiceMutation.isPending ? 'Создание счета...' : 'Выставить счет'}
          </Button>
        )}
        
        {project.status === 'invoiced' && project.invoiceNumber && (
          <Button 
            onClick={() => markPaidMutation.mutate(project.invoiceNumber!)}
            disabled={markPaidMutation.isPending}
          >
            Отметить оплаченным
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="services">Услуги</TabsTrigger>
          <TabsTrigger value="timeline">Хронология</TabsTrigger>
          <TabsTrigger value="files">Файлы</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Информация о клиенте установки */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Клиент установки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {project.installationPersonFirstName && project.installationPersonLastName ? (
                  <>
                    <div>
                      <p className="text-sm text-gray-600">Имя и фамилия</p>
                      <p className="font-medium">{project.installationPersonFirstName} {project.installationPersonLastName}</p>
                    </div>
                    {project.installationPersonPhone && (
                      <div>
                        <p className="text-sm text-gray-600">Телефон</p>
                        <p className="font-medium">{project.installationPersonPhone}</p>
                      </div>
                    )}
                    {project.installationPersonAddress && (
                      <div>
                        <p className="text-sm text-gray-600">Адрес установки</p>
                        <p className="font-medium">{project.installationPersonAddress}</p>
                      </div>
                    )}
                    {project.installationPersonUniqueId && (
                      <div>
                        <p className="text-sm text-gray-600">Уникальный ID</p>
                        <p className="font-medium">{project.installationPersonUniqueId}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">Информация не указана</p>
                )}
              </CardContent>
            </Card>
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Информация о проекте
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">ID проекта</span>
                    <p className="font-medium">#{project.id}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Номер команды</span>
                    <p className="font-medium">{project.teamNumber || 'Не указан'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Дата начала</span>
                    <p className="font-medium">
                      {project.startDate ? format(new Date(project.startDate), 'dd.MM.yyyy', { locale: ru }) : 'Не указана'}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Дата окончания</span>
                    <p className="font-medium">
                      {project.endDate ? format(new Date(project.endDate), 'dd.MM.yyyy', { locale: ru }) : 'Не указана'}
                    </p>
                  </div>
                </div>
                {project.notes && (
                  <div>
                    <span className="text-sm text-gray-500">Описание</span>
                    <p className="mt-1">{project.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Информация о клиенте
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client ? (
                  <>
                    <div>
                      <span className="text-sm text-gray-500">Имя</span>
                      <p className="font-medium">{(client as Client).name}</p>
                    </div>
                    {(client as Client).email && (
                      <div>
                        <span className="text-sm text-gray-500">Email</span>
                        <p className="font-medium">{(client as Client).email}</p>
                      </div>
                    )}
                    {(client as Client).phone && (
                      <div>
                        <span className="text-sm text-gray-500">Телефон</span>
                        <p className="font-medium">{(client as Client).phone}</p>
                      </div>
                    )}
                    {(client as Client).address && (
                      <div>
                        <span className="text-sm text-gray-500">Адрес</span>
                        <p className="font-medium">{(client as Client).address}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">Загрузка информации о клиенте...</p>
                )}
              </CardContent>
            </Card>

            {/* Crew Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Назначенная бригада
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {crew ? (
                  <>
                    <div>
                      <span className="text-sm text-gray-500">Название</span>
                      <p className="font-medium">{(crew as Crew).name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Руководитель</span>
                      <p className="font-medium">{(crew as Crew).leaderName}</p>
                    </div>
                    {(crew as Crew).phone && (
                      <div>
                        <span className="text-sm text-gray-500">Телефон</span>
                        <p className="font-medium">{(crew as Crew).phone}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500">Бригада не назначена</p>
                )}
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Euro className="h-5 w-5 mr-2" />
                  Финансовая сводка
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Общая сумма</span>
                    <p className="text-2xl font-bold">€{totalAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Количество услуг</span>
                    <p className="text-2xl font-bold">{(services as Service[]).length}</p>
                  </div>
                </div>
                {project.invoiceNumber && (
                  <div>
                    <span className="text-sm text-gray-500">Номер счета</span>
                    <p className="font-medium">№{project.invoiceNumber}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services">
          <ServicesPage selectedFirm={selectedFirm} projectId={projectId} />
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Хронология проекта</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Проект создан</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(project.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </p>
                  </div>
                </div>
                
                {project.startDate && (
                  <div className="flex items-center space-x-4">
                    <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Начало работ</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(project.startDate), 'dd.MM.yyyy', { locale: ru })}
                      </p>
                    </div>
                  </div>
                )}
                
                {project.endDate && (
                  <div className="flex items-center space-x-4">
                    <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="font-medium">Планируемое завершение</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(project.endDate), 'dd.MM.yyyy', { locale: ru })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Файлы проекта</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Файлы не загружены</h3>
                <p className="text-gray-500">Загрузите документы, фотографии и отчеты по проекту</p>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Загрузить файлы
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}