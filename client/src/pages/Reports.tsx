import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, Upload, Image, FileText, Trash2, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertProjectReportSchema, insertProjectFileSchema, type ProjectReport, type ProjectFile } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const reportFormSchema = insertProjectReportSchema.extend({
  rating: z.number().min(1, "Оценка обязательна").max(5, "Максимальная оценка 5"),
});

const fileFormSchema = insertProjectFileSchema.extend({
  fileUrl: z.string().url("Введите корректный URL файла"),
});

interface ReportsPageProps {
  selectedFirm: string;
  projectId?: number;
}

export default function ReportsPage({ selectedFirm, projectId }: ReportsPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ProjectReport | null>(null);

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'reports'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/reports`, 'GET');
      return await response.json();
    },
    enabled: !!projectId,
  });

  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'files'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/files`, 'GET');
      return await response.json();
    },
    enabled: !!projectId,
  });

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
      fileUrl: '',
      fileName: '',
      fileType: 'report_photo' as const,
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
    mutationFn: (data: any) => apiRequest(`/api/projects/${projectId}/files`, 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
      toast({ title: 'Файл добавлен успешно' });
      setIsFileDialogOpen(false);
      fileForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить файл',
        variant: 'destructive'
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => apiRequest(`/api/files/${fileId}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'files'] });
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

  const onSubmitReport = (data: z.infer<typeof reportFormSchema>) => {
    if (editingReport) {
      updateReportMutation.mutate(data);
    } else {
      createReportMutation.mutate(data);
    }
  };

  const onSubmitFile = (data: z.infer<typeof fileFormSchema>) => {
    createFileMutation.mutate(data);
  };

  const handleEditReport = (report: ProjectReport) => {
    setEditingReport(report);
    reportForm.setValue('rating', report.rating);
    reportForm.setValue('reviewText', report.reviewText || '');
    reportForm.setValue('reviewDocumentUrl', report.reviewDocumentUrl || '');
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

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Проект не выбран</h3>
          <p className="text-gray-500">Выберите проект для управления отчетами</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Фото отчеты и оценки</h1>
          <p className="text-gray-600">Управление фото отчетами выполненных работ и отзывами</p>
        </div>
      </div>

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

                <FormField
                  control={fileForm.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL файла</FormLabel>
                      <FormControl>
                        <Input 
                          type="url" 
                          placeholder="https://example.com/file.jpg" 
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
                  <img
                    src={file.fileUrl}
                    alt={file.fileName || 'Фото отчет'}
                    className="w-full h-40 object-cover rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.svg';
                    }}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(file.fileUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {file.fileName && (
                    <p className="text-xs text-gray-600 mt-2 truncate">{file.fileName}</p>
                  )}
                </div>
              ))}
              {photoFiles.length === 0 && (
                <div className="col-span-full text-center py-8">
                  <Image className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Фото отчеты не добавлены</p>
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
                        {new Date(report.completedAt || report.createdAt).toLocaleDateString('ru-RU')}
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
                        Открыть документ отзыва
                      </a>
                    </div>
                  )}
                </div>
              ))}

              {reports.length === 0 && (
                <div className="text-center py-8">
                  <Star className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Отчеты не созданы</h3>
                  <p className="text-gray-500">Создайте отчет о выполненной работе с оценкой качества</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Documents Section */}
      {reviewFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Документы отзывов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reviewFiles.map((file: ProjectFile) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">{file.fileName || 'Документ отзыва'}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(file.uploadedAt).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(file.fileUrl, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteFileMutation.mutate(file.id)}
                      disabled={deleteFileMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}