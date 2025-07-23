import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileText, Users, Package, Clock, Euro, Calendar, Building2, Phone, History, Star, Plus, Upload, Image, Trash2, Eye, MessageSquare, Download, Send, StickyNote, User } from 'lucide-react';
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
import { GoogleCalendarWidget } from '@/components/GoogleCalendarWidget';
import { FileUpload } from '@/components/FileUpload';

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
  send_invoice: 'Отправить счет',
  invoice_sent: 'Счет отправлен',
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
  send_invoice: 'bg-purple-100 text-purple-800',
  invoice_sent: 'bg-cyan-100 text-cyan-800',
  paid: 'bg-gray-100 text-gray-800'
};

const priorityLabels = {
  normal: 'Обычное',
  important: 'Важное',
  urgent: 'Срочное',
  critical: 'Критическое'
};

const priorityColors = {
  normal: 'bg-gray-100 text-gray-800',
  important: 'bg-blue-100 text-blue-800',
  urgent: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
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
  const [, setLocation] = useLocation();
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
      priority: 'normal' as const,
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

  const downloadInvoicePdfMutation = useMutation({
    mutationFn: () => apiRequest(`/api/invoice/download-pdf/${projectId}`, 'POST'),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'history'] });
      toast({ 
        title: 'Успешно', 
        description: response.message || 'PDF счета скачан и добавлен в файлы проекта'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось скачать PDF счета',
        variant: 'destructive'
      });
    },
  });

  // Reports mutations
  const deleteReportMutation = useMutation({
    mutationFn: (reportId: number) => apiRequest(`/api/reports/${reportId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'reports'] });
      toast({ title: 'Отзыв удален успешно' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить отзыв',
        variant: 'destructive'
      });
    },
  });

  // Files mutations



  // Notes mutations
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
      toast({ title: 'Примечание добавлено' });
      setIsNoteDialogOpen(false);
      noteForm.reset();
    },
    onError: (error: any) => {
      console.error('createNoteMutation onError:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить примечание',
        variant: 'destructive'
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => apiRequest(`/api/notes/${noteId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'notes'] });
      toast({ title: 'Примечание удалено' });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить примечание',
        variant: 'destructive'
      });
    },
  });

  const sendInvoiceEmailMutation = useMutation({
    mutationFn: () => apiRequest(`/api/invoice/send-email/${projectId}`, 'POST'),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'history'] });
      toast({ 
        title: 'Успешно', 
        description: response.message || 'Счет отправлен клиенту по email'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить счет',
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
    createNoteMutation.mutate(data);
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

  const photoFiles = files.filter((file: ProjectFile) => file.fileType === 'report_photo');
  const reviewFiles = files.filter((file: ProjectFile) => file.fileType === 'review_document');

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
              <Button variant="ghost" onClick={() => setLocation('/projects')} className="hover:bg-blue-50">
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

            {/* Вкладки - перемещены сюда */}
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
                  {/* Reviews Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Отзывы клиентов
                        </div>
                        <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingReport(null);
                                reportForm.reset({
                                  projectId: project.id,
                                  rating: 5,
                                  reviewText: '',
                                  reviewDocumentUrl: '',
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Добавить отзыв
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{editingReport ? 'Редактировать отзыв' : 'Добавить отзыв'}</DialogTitle>
                            </DialogHeader>
                            <Form {...reportForm}>
                              <form onSubmit={reportForm.handleSubmit(onSubmitReport)} className="space-y-4">
                                <FormField
                                  control={reportForm.control}
                                  name="rating"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Оценка</FormLabel>
                                      <FormControl>
                                        <Select 
                                          value={field.value.toString()} 
                                          onValueChange={(value) => field.onChange(parseInt(value))}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[5, 4, 3, 2, 1].map((rating) => (
                                              <SelectItem key={rating} value={rating.toString()}>
                                                <div className="flex gap-1">
                                                  {renderStars(rating)}
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
                                      <FormLabel>Текст отзыва</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} rows={4} />
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
                                      <FormLabel>URL документа (опционально)</FormLabel>
                                      <FormControl>
                                        <Input {...field} type="url" placeholder="https://example.com/document.pdf" />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="flex justify-end gap-2">
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
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {reportsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : reports.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Нет отзывов</p>
                      ) : (
                        <div className="space-y-4">
                          {reports.map((report: ProjectReport) => (
                            <div key={report.id} className="border rounded-lg p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex gap-1">
                                  {renderStars(report.rating)}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditReport(report)}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteReportMutation.mutate(report.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                              {report.reviewText && (
                                <p className="text-gray-700">{report.reviewText}</p>
                              )}
                              {report.reviewDocumentUrl && (
                                <a
                                  href={report.reviewDocumentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  Просмотр документа
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Photo Reports Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Image className="h-5 w-5" />
                        Фото отчеты выполненных работ ({photoFiles.length}/10)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {filesLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {photoFiles.map((file: ProjectFile) => (
                            <div key={file.id} className="relative group">
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block aspect-square bg-gray-100 rounded-lg overflow-hidden"
                              >
                                <Image className="h-full w-full object-cover text-gray-400" />
                              </a>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => deleteFileMutation.mutate(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              {file.fileName && (
                                <p className="mt-1 text-sm text-gray-600 truncate">{file.fileName}</p>
                              )}
                            </div>
                          ))}
                          {photoFiles.length < 10 && (
                            <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="aspect-square h-full"
                                  onClick={() => {
                                    fileForm.reset({
                                      projectId: project.id,
                                      fileName: '',
                                      fileType: 'report_photo',
                                    });
                                  }}
                                >
                                  <Plus className="h-8 w-8" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Добавить фото</DialogTitle>
                                </DialogHeader>
                                <Form {...fileForm}>
                                  <form onSubmit={fileForm.handleSubmit(onSubmitFile)} className="space-y-4">
                                    <FileUpload 
                                      projectId={project.id}
                                      onFileUploaded={() => {
                                        queryClient.invalidateQueries({ queryKey: ['/api/projects', project.id, 'files'] });
                                        setIsFileDialogOpen(false);
                                      }}
                                    />
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Review Documents Section */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Документы отзывов клиентов
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {reviewFiles.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Нет документов</p>
                      ) : (
                        <div className="space-y-2">
                          {reviewFiles.map((file: ProjectFile) => (
                            <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                              <a
                                href={file.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-600 hover:underline"
                              >
                                <FileText className="h-4 w-4" />
                                {file.fileName || 'Документ'}
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteFileMutation.mutate(file.id)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StickyNote className="h-5 w-5" />
                          Примечания к проекту
                        </div>
                        <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                noteForm.reset({
                                  projectId: project.id,
                                  content: '',
                                  userId: user?.id || '',
                                  priority: 'normal' as const,
                                });
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Добавить примечание
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Добавить примечание</DialogTitle>
                            </DialogHeader>
                            <Form {...noteForm}>
                              <form onSubmit={noteForm.handleSubmit(onSubmitNote)} className="space-y-4">
                                <FormField
                                  control={noteForm.control}
                                  name="content"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Текст примечания</FormLabel>
                                      <FormControl>
                                        <Textarea {...field} rows={4} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={noteForm.control}
                                  name="priority"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Приоритет</FormLabel>
                                      <FormControl>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="low">Низкий</SelectItem>
                                            <SelectItem value="normal">Обычный</SelectItem>
                                            <SelectItem value="high">Высокий</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <div className="flex justify-end gap-2">
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
                                    {createNoteMutation.isPending ? 'Сохранение...' : 'Создать'}
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {notesLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      ) : notes.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">Нет примечаний</p>
                      ) : (
                        <div className="space-y-3">
                          {notes.map((note: ProjectNote) => (
                            <div 
                              key={note.id} 
                              className={`border rounded-lg p-4 space-y-2 ${
                                note.priority === 'high' ? 'border-red-300 bg-red-50' :
                                note.priority === 'low' ? 'border-gray-200 bg-gray-50' :
                                'border-blue-300 bg-blue-50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-gray-700">{note.content}</p>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {note.userId}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {format(new Date(note.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      note.priority === 'high' ? 'bg-red-200 text-red-700' :
                                      note.priority === 'low' ? 'bg-gray-200 text-gray-700' :
                                      'bg-blue-200 text-blue-700'
                                    }`}>
                                      {note.priority === 'high' ? 'Высокий' :
                                       note.priority === 'low' ? 'Низкий' : 'Обычный'}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteNoteMutation.mutate(note.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
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

            {/* Google Calendar Integration */}
            <GoogleCalendarWidget 
              projectId={project.id}
              crewId={project.crewId || undefined}
              projectStatus={project.status}
            />

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
                  
                  <div className="flex gap-2">
                    {project.invoiceUrl && (
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <a href={project.invoiceUrl} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          Онлайн счет
                        </a>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => downloadInvoicePdfMutation.mutate()}
                      disabled={downloadInvoicePdfMutation.isPending}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {downloadInvoicePdfMutation.isPending ? 'Скачивание...' : 'Скачать PDF'}
                    </Button>
                  </div>
                  
                  {project.status === 'invoiced' && client?.email && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => sendInvoiceEmailMutation.mutate()}
                      disabled={sendInvoiceEmailMutation.isPending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {sendInvoiceEmailMutation.isPending ? 'Отправка...' : 'Отправить счет клиенту'}
                    </Button>
                  )}
                  
                  {project.status === 'invoiced' && !client?.email && (
                    <p className="text-sm text-amber-600 mt-2">
                      У клиента не указан email адрес
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* История проекта - перемещена вниз */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border p-6">
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

    </div>
  );
}
