import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Users, Package, Clock, Euro, Calendar, Building2, Phone, History, Star, Plus, Upload, Image, Trash2, Eye, MessageSquare } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { type Project, type Service, type Client, type Crew, insertProjectReportSchema, insertProjectFileSchema, insertProjectNoteSchema, type ProjectReport, type ProjectFile, type ProjectNote } from '@shared/schema';
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

// Reports schemas
const reportFormSchema = insertProjectReportSchema.extend({
  rating: z.number().min(1, "Оценка обязательна").max(5, "Максимальная оценка 5"),
});

const fileFormSchema = z.object({
  projectId: z.number(),
  fileName: z.string().min(1, "Название файла обязательно"),
  fileType: z.enum(['report_photo', 'review_document', 'technical_doc', 'other']),
});

const noteFormSchema = insertProjectNoteSchema.extend({
  content: z.string().min(1, "Текст примечания обязателен"),
});

export default function ProjectDetail({ projectId, selectedFirm, onBack }: ProjectDetailProps) {
  const [activeTab, setActiveTab] = useState('services');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProjectReport | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
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
    gcTime: 0,
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

  // Reports and Files queries
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'reports'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/reports`, 'GET');
      return await response.json();
    },
    enabled: !!project,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/files/project', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/files/project/${projectId}`, 'GET');
      return await response.json();
    },
    enabled: !!project,
  });

  const { data: notes = [], isLoading: notesLoading, error: notesError } = useQuery({
    queryKey: ['/api/projects', projectId, 'notes'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/notes`, 'GET');
      return await response.json();
    },
    enabled: !!project,
    // refetchInterval: 3000, // Временно отключено для тестирования
  });

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

  // Reports forms and mutations
  const reportForm = useForm({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      projectId: projectId || 0,
      rating: 5,
      reviewText: '',
      reviewDocumentUrl: '',
    },
  });

  const fileForm = useForm({
    resolver: zodResolver(fileFormSchema),
    defaultValues: {
      projectId: projectId || 0,
      fileName: '',
      fileType: 'report_photo' as const,
    },
  });

  const noteForm = useForm({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      projectId: projectId || 0,
      content: '',
      userId: user?.id || '',
    },
  });

  const createReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/reports`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'reports'] });
      toast({ title: 'Отчет создан успешно' });
      setIsReportDialogOpen(false);
      reportForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать отчет',
        variant: 'destructive'
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/reports/${editingReport?.id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'reports'] });
      toast({ title: 'Отчет обновлен успешно' });
      setEditingReport(null);
      setIsReportDialogOpen(false);
      reportForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось обновить отчет',
        variant: 'destructive'
      });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedFile) {
        throw new Error('Файл не выбран');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', 'project_file');
      formData.append('projectId', projectId.toString());

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка загрузки файла');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
      toast({ title: 'Файл загружен успешно' });
      setIsFileDialogOpen(false);
      setSelectedFile(null);
      fileForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось загрузить файл',
        variant: 'destructive'
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (reportId: number) => apiRequest(`/api/reports/${reportId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'reports'] });
      toast({ title: 'Отчет удален успешно' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить отчет',
        variant: 'destructive'
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => apiRequest(`/api/files/${fileId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
      toast({ title: 'Файл удален успешно' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить файл',
        variant: 'destructive'
      });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: (data: any) => {
      console.log('createNoteMutation mutationFn вызвана:', data);
      console.log('URL запроса:', `/api/projects/${projectId}/notes`);
      return apiRequest(`/api/projects/${projectId}/notes`, 'POST', data);
    },
    onSuccess: (result) => {
      console.log('createNoteMutation onSuccess:', result);
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'notes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'history'] });
      toast({ title: 'Примечание добавлено успешно' });
      setIsNoteDialogOpen(false);
      noteForm.reset();
    },
    onError: (error: any) => {
      console.log('createNoteMutation onError:', error);
      console.log('Детали ошибки:', {
        message: error.message,
        status: error.status,
        response: error.response
      });
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить примечание',
        variant: 'destructive'
      });
    },
  });

  const onSubmitReport = (data: any) => {
    if (editingReport) {
      updateReportMutation.mutate(data);
    } else {
      createReportMutation.mutate(data);
    }
  };

  const onSubmitFile = (data: any) => {
    if (!selectedFile) {
      toast({
        title: 'Ошибка',
        description: 'Выберите файл для загрузки',
        variant: 'destructive'
      });
      return;
    }
    createFileMutation.mutate(data);
  };

  const onSubmitNote = (data: any) => {
    console.log('🔥 onSubmitNote вызвана!');
    console.log('📝 Данные формы:', data);
    console.log('🚦 createNoteMutation статус до вызова:', {
      isPending: createNoteMutation.isPending,
      isError: createNoteMutation.isError,
      error: createNoteMutation.error
    });
    console.log('🎯 Вызываем createNoteMutation.mutate()...');
    createNoteMutation.mutate(data);
    console.log('✅ createNoteMutation.mutate() вызван');
  };

  const handleEditReport = (report: ProjectReport) => {
    setEditingReport(report);
    reportForm.reset({
      projectId: report.projectId,
      rating: report.rating,
      reviewText: report.reviewText || '',
      reviewDocumentUrl: report.reviewDocumentUrl || '',
    });
    setIsReportDialogOpen(true);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  const getFileTypeLabel = (fileType: string) => {
    switch (fileType) {
      case 'report_photo': return 'Фото отчет';
      case 'review_document': return 'Документ отзыва';
      case 'acceptance': return 'Приемка';
      default: return fileType;
    }
  };

  const photoFiles = files.filter((file: any) => 
    file.category === 'project_file' && file.mimeType && file.mimeType.startsWith('image/')
  );
  const allFiles = files.filter((file: any) => file.category === 'project_file');

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
                  <p className="text-sm text-gray-500">Дата начала проекта</p>
                  <p className="font-medium text-gray-900">
                    {project.startDate ? 
                      format(new Date(project.startDate), 'dd.MM.yyyy', { locale: ru }) : 
                      'Не установлена'
                    }
                  </p>
                </div>

                {project.equipmentExpectedDate && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Ожидаемая поставка оборудования</p>
                    <p className="font-medium text-gray-900">
                      {format(new Date(project.equipmentExpectedDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                )}

                {project.equipmentArrivedDate && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Фактическая поставка</p>
                    <p className="font-medium text-green-700">
                      {format(new Date(project.equipmentArrivedDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                )}

                {project.workStartDate && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Ожидаемое начало работ</p>
                    <p className="font-medium text-blue-700">
                      {format(new Date(project.workStartDate), 'dd.MM.yyyy', { locale: ru })}
                    </p>
                  </div>
                )}
                
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
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="services" className="text-sm">Услуги проекта</TabsTrigger>
              <TabsTrigger value="management" className="text-sm">Управление датами</TabsTrigger>
              <TabsTrigger value="files" className="text-sm">Файлы и отчеты</TabsTrigger>
              <TabsTrigger value="notes" className="text-sm">Примечания</TabsTrigger>
            </TabsList>

            <TabsContent value="services" className="space-y-4">
              <ServicesPage 
                projectId={project.id} 
                selectedFirm={selectedFirm}
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



            <TabsContent value="files" className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-4">
                <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Upload className="h-4 w-4 mr-2" />
                      Добавить фото
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Добавить файл проекта</DialogTitle>
                    </DialogHeader>
                    <Form {...fileForm}>
                      <form onSubmit={fileForm.handleSubmit(onSubmitFile)} className="space-y-4">
                        <FormField
                          control={fileForm.control}
                          name="fileType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Тип файла</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="report_photo">Фото отчет выполненной работы</SelectItem>
                                  <SelectItem value="review_document">Документ отзыва (PDF/фото)</SelectItem>
                                  <SelectItem value="acceptance">Документ приемки</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={fileForm.control}
                          name="fileName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Название файла</FormLabel>
                              <FormControl>
                                <Input placeholder="Введите название файла" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Файл</label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx,.txt"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFile(file);
                                  fileForm.setValue('fileName', file.name);
                                }
                              }}
                              className="hidden"
                              id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                              <p className="text-gray-600">
                                {selectedFile ? selectedFile.name : 'Нажмите для выбора файла'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Поддерживаются изображения, PDF, DOC, TXT
                              </p>
                            </label>
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsFileDialogOpen(false)}
                          >
                            Отмена
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createFileMutation.isPending}
                          >
                            {createFileMutation.isPending ? 'Сохранение...' : 'Добавить'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Создать отчет
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingReport ? 'Редактировать отчет' : 'Создать отчет о выполненной работе'}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...reportForm}>
                      <form onSubmit={reportForm.handleSubmit(onSubmitReport)} className="space-y-4">
                        <FormField
                          control={reportForm.control}
                          name="rating"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Оценка качества работы (1-5 звезд)</FormLabel>
                              <FormControl>
                                <Select 
                                  onValueChange={(value) => field.onChange(parseInt(value))}
                                  defaultValue={field.value.toString()}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                      <SelectItem key={rating} value={rating.toString()}>
                                        <div className="flex items-center gap-2">
                                          <span>{rating}</span>
                                          <div className="flex">
                                            {renderStars(rating)}
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={reportForm.control}
                          name="reviewText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Письменный отзыв</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Опишите выполненную работу, качество установки, возникшие проблемы..."
                                  className="min-h-[100px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={reportForm.control}
                          name="reviewDocumentUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>URL документа отзыва (опционально)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="url" 
                                  placeholder="https://example.com/review.pdf" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setIsReportDialogOpen(false);
                              setEditingReport(null);
                              reportForm.reset();
                            }}
                          >
                            Отмена
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createReportMutation.isPending || updateReportMutation.isPending}
                          >
                            {(createReportMutation.isPending || updateReportMutation.isPending) 
                              ? 'Сохранение...' 
                              : editingReport ? 'Обновить' : 'Создать'
                            }
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Photo Reports Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Файлы проекта ({allFiles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filesLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {allFiles.map((file: any) => (
                        <div key={file.id} className="relative group cursor-pointer">
                          {file.mimeType && file.mimeType.startsWith('image/') ? (
                            <img
                              src={`/api/files/${file.fileId}`}
                              alt={file.originalName || 'Фото отчет'}
                              className="w-full h-40 object-cover rounded-lg"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                              }}
                            />
                          ) : (
                            <div className="w-full h-40 bg-gray-100 rounded-lg flex items-center justify-center">
                              <FileText className="h-12 w-12 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(`/api/files/${file.fileId}`, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteFileMutation.mutate(file.fileId)}
                              disabled={deleteFileMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {file.originalName && (
                            <p className="text-xs text-gray-600 mt-2 truncate">{file.originalName}</p>
                          )}
                        </div>
                      ))}
                      {allFiles.length === 0 && (
                        <div className="col-span-full text-center py-8">
                          <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500">Файлы проекта не добавлены</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reports and Reviews Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Отчеты и оценки качества работ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reportsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reports.map((report: ProjectReport) => (
                        <div key={report.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                              <div className="flex">{renderStars(report.rating)}</div>
                              <span className="text-sm text-gray-500">
                                {(() => {
                                  const dateToFormat = report.completedAt || report.createdAt;
                                  return dateToFormat ? new Date(dateToFormat).toLocaleDateString('ru-RU') : 'Не указано';
                                })()}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditReport(report)}
                              >
                                Редактировать
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteReportMutation.mutate(report.id)}
                                disabled={deleteReportMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {report.reviewText && (
                            <p className="text-gray-700 mb-3">{report.reviewText}</p>
                          )}
                          
                          {report.reviewDocumentUrl && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <a 
                                href={report.reviewDocumentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Просмотреть документ отзыва
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                      {reports.length === 0 && (
                        <div className="text-center py-8">
                          <Star className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500">Отчеты не созданы</p>
                          <p className="text-gray-400 text-sm">Создайте отчет о выполненной работе с оценкой качества</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-4">
                <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Добавить примечание
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Добавить примечание к проекту</DialogTitle>
                    </DialogHeader>
                    <Form {...noteForm}>
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        console.log('🔴 Form submit event triggered');
                        console.log('📋 Current form values:', noteForm.getValues());
                        console.log('❌ Form errors:', noteForm.formState.errors);
                        console.log('✅ Form valid:', noteForm.formState.isValid);
                        noteForm.handleSubmit(onSubmitNote)(e);
                      }} className="space-y-4">
                        <FormField
                          control={noteForm.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Текст примечания</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Введите примечание или комментарий к проекту..."
                                  className="min-h-[120px]"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Hidden field for userId */}
                        <FormField
                          control={noteForm.control}
                          name="userId"
                          render={({ field }) => (
                            <Input type="hidden" {...field} value={user?.id || ''} />
                          )}
                        />

                        <div className="flex justify-end space-x-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => {
                              setIsNoteDialogOpen(false);
                              noteForm.reset();
                            }}
                          >
                            Отмена
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createNoteMutation.isPending}
                          >
                            {createNoteMutation.isPending ? 'Сохранение...' : 'Добавить примечание'}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Notes List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                    Примечания проекта
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    console.log('Notes render - состояние:', {
                      notesLoading,
                      notesLength: notes.length,
                      notes,
                      notesError
                    });
                    return null;
                  })()}
                  {notesLoading ? (
                    <div className="text-center py-4">Загрузка примечаний...</div>
                  ) : notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Примечания к проекту пока не добавлены</p>
                      <p className="text-sm">Используйте кнопку выше для добавления первого примечания</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note: ProjectNote) => (
                        <div key={note.id} className="border rounded-lg p-4 bg-gray-50">
                          <div className="flex items-start justify-between mb-2">
                            <div className="text-sm text-gray-600">
                              Добавлено {note.createdAt ? format(new Date(note.createdAt), 'dd.MM.yyyy в HH:mm', { locale: ru }) : 'Не указано'}
                            </div>
                          </div>
                          <div className="text-gray-900 whitespace-pre-wrap">
                            {note.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>


    </div>
  );
}