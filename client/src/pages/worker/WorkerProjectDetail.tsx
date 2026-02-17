import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useLocation } from 'wouter';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageViewer } from '@/components/ui/image-viewer';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Phone,
  User,
  Camera,
  MessageSquare,
  Image,
  Send,
  X,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ProjectDetail {
  id: number;
  status: string;
  workStartDate: string | null;
  workEndDate: string | null;
  equipmentExpectedDate: string | null;
  equipmentArrivedDate: string | null;
  installationPersonFirstName: string | null;
  installationPersonLastName: string | null;
  installationPersonAddress: string | null;
  installationPersonPhone: string | null;
  notes: string | null;
  client: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  files: Array<{
    id: number;
    fileName: string;
    fileUrl: string;
    fileType: string;
    uploadedAt: string;
  }>;
  comments: Array<{
    id: number;
    content: string;
    priority: string;
    createdAt: string;
  }>;
}

interface Reclamation {
  id: number;
  description: string;
  deadline: string | null;
  status: string;
  createdAt: string;
}

interface Service {
  id: number;
  description: string;
  quantity: string;
  productKey: string | null;
}

// Status configuration with colors and labels
const statusConfig: Record<string, {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
}> = {
  planning: {
    label: 'Планирование',
    dotColor: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
  },
  equipment_waiting: {
    label: 'Ждём оборудование',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
  },
  equipment_arrived: {
    label: 'Оборудование есть',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  work_scheduled: {
    label: 'Запланировано',
    dotColor: 'bg-purple-500',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
  },
  work_in_progress: {
    label: 'В работе',
    dotColor: 'bg-orange-500',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
  },
  work_completed: {
    label: 'Завершено',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
  },
  reclamation: {
    label: 'Рекламация',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
};

const getStatusConfig = (status: string) => {
  return statusConfig[status] || {
    label: status,
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
  };
};

export default function WorkerProjectDetail() {
  const [, params] = useRoute('/worker/projects/:id');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [commentText, setCommentText] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string } | null>(null);

  const projectId = params?.id ? parseInt(params.id) : null;

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['/api/worker/projects', projectId],
    queryFn: async () => {
      const response = await apiRequest(`/api/worker/projects/${projectId}`, 'GET');
      return response.json();
    },
    enabled: !!projectId,
  });

  // Load reclamations for this project (only my crew's accepted/in_progress)
  // Note: Query always runs when project is loaded with reclamation status
  // Backend handles filtering by crew and status
  const { data: reclamationsData, isLoading: reclamationsLoading } = useQuery<{ reclamations: Reclamation[] }>({
    queryKey: ['/api/worker/projects', projectId, 'reclamations', project?.status],
    queryFn: async () => {
      const response = await apiRequest(`/api/worker/projects/${projectId}/reclamations`, 'GET');
      return response.json();
    },
    // Only fetch when we have a project with reclamation status
    enabled: !!projectId && !!project && project.status === 'reclamation',
  });

  const reclamations = reclamationsData?.reclamations || [];

  // Load services for this project
  const { data: servicesData, isLoading: servicesLoading } = useQuery<{ services: Service[] }>({
    queryKey: ['/api/worker/projects', projectId, 'services'],
    queryFn: async () => {
      const response = await apiRequest(`/api/worker/projects/${projectId}/services`, 'GET');
      return response.json();
    },
    enabled: !!projectId,
  });

  const projectServices = servicesData?.services || [];

  // Complete reclamation mutation
  const completeReclamationMutation = useMutation({
    mutationFn: async (reclamationId: number) => {
      const response = await apiRequest(`/api/worker/reclamations/${reclamationId}/complete`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Рекламация отмечена как выполненная',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/projects', projectId, 'reclamations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));

      const response = await fetch(`/api/worker/projects/${projectId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Photos uploaded successfully',
      });
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ['/api/worker/projects', projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/worker/projects/${projectId}/comments`, 'POST', {
        content,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Comment added',
      });
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['/api/worker/projects', projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to add comment',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const handleComment = () => {
    if (commentText.trim()) {
      commentMutation.mutate(commentText.trim());
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return format(new Date(dateStr), 'd MMMM yyyy', { locale: ru });
  };

  const getPersonName = () => {
    if (!project) return '';
    const firstName = project.installationPersonFirstName || '';
    const lastName = project.installationPersonLastName || '';
    return [firstName, lastName].filter(Boolean).join(' ') || project.client?.name || 'Unknown';
  };

  if (isLoading) {
    return (
      <WorkerLayout title="Loading...">
        <div className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </WorkerLayout>
    );
  }

  if (!project) {
    return (
      <WorkerLayout title="Error">
        <div className="p-4 text-center">
          <p className="text-gray-500">Project not found</p>
          <Button onClick={() => navigate('/worker/projects')} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </WorkerLayout>
    );
  }

  return (
    <WorkerLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/worker/projects')}
              className="p-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold truncate">{getPersonName()}</h1>
              {(() => {
                const config = getStatusConfig(project.status);
                return (
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
                    {config.label}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3 mx-4 mt-3">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="photos">
              Photos
              {project.files?.length > 0 && (
                <span className="ml-1 text-xs bg-gray-200 px-1.5 rounded-full">
                  {project.files.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="flex-1 p-4 space-y-4 overflow-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span>{getPersonName()}</span>
                </div>
                {(project.installationPersonAddress || project.client?.address) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-sm">
                      {project.installationPersonAddress || project.client?.address}
                    </span>
                  </div>
                )}
                {(project.installationPersonPhone || project.client?.phone) && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a
                      href={`tel:${project.installationPersonPhone || project.client?.phone}`}
                      className="text-primary"
                    >
                      {project.installationPersonPhone || project.client?.phone}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="text-sm text-gray-500">Work Date: </span>
                    <span className="font-medium">{formatDate(project.workStartDate)}</span>
                    {project.workEndDate &&
                      project.workEndDate !== project.workStartDate && (
                        <span className="font-medium"> - {formatDate(project.workEndDate)}</span>
                      )}
                  </div>
                </div>
                {project.equipmentArrivedDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 flex items-center justify-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <span>Equipment arrived: {formatDate(project.equipmentArrivedDate)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {project.notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Services Section - what work needs to be done */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Работы на объекте
                </CardTitle>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Загрузка услуг...
                  </div>
                ) : projectServices.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет запланированных работ</p>
                ) : (
                  <ul className="space-y-2">
                    {projectServices.map((service) => (
                      <li key={service.id} className="flex items-start gap-2 text-sm">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                        <div className="flex-1">
                          <span>{service.description}</span>
                          {service.quantity && parseFloat(service.quantity) !== 1 && (
                            <span className="text-gray-500 ml-1">
                              × {service.quantity}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Reclamations Section - show when project has reclamation status */}
            {project.status === 'reclamation' && (
              <Card className="border-red-200 bg-red-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Рекламации
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reclamationsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Загрузка рекламаций...
                    </div>
                  ) : reclamations.length === 0 ? (
                    <p className="text-sm text-gray-500">Нет активных рекламаций для вашей бригады</p>
                  ) : (
                    reclamations.map((reclamation) => (
                      <div
                        key={reclamation.id}
                        className="bg-white rounded-lg p-3 border border-red-200 space-y-2"
                      >
                        <p className="text-sm font-medium">{reclamation.description}</p>

                        {reclamation.deadline && (
                          <div className="flex items-center gap-1.5 text-sm text-gray-600">
                            <Clock className="w-4 h-4 text-red-500" />
                            <span>Срок: {formatDate(reclamation.deadline)}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            reclamation.status === 'accepted'
                              ? 'bg-blue-100 text-blue-700'
                              : reclamation.status === 'in_progress'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {reclamation.status === 'accepted' ? 'Принято' :
                             reclamation.status === 'in_progress' ? 'В работе' :
                             reclamation.status}
                          </span>

                          {(reclamation.status === 'accepted' || reclamation.status === 'in_progress') && (
                            <Button
                              size="sm"
                              onClick={() => completeReclamationMutation.mutate(reclamation.id)}
                              disabled={completeReclamationMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {completeReclamationMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Завершить
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos" className="flex-1 p-4 space-y-4 overflow-auto">
            {/* Upload Section */}
            <Card>
              <CardContent className="p-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {selectedFiles.length === 0 ? (
                  <Button
                    variant="outline"
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <Camera className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                      <span className="text-sm text-gray-500">Add Photos</span>
                    </div>
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="relative aspect-square">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removeFile(index)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400"
                      >
                        <Camera className="w-6 h-6 text-gray-400" />
                      </button>
                    </div>
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      className="w-full"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>Upload {selectedFiles.length} photo(s)</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Existing Photos */}
            {project.files && project.files.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Uploaded Photos</h3>
                <div className="grid grid-cols-3 gap-2">
                  {project.files
                    .filter((f) => f.fileType?.startsWith('image/'))
                    .map((file) => {
                      const imageUrl = `${file.fileUrl}?token=${accessToken}`;
                      return (
                        <button
                          key={file.id}
                          onClick={() => setViewerImage({ src: imageUrl, alt: file.fileName })}
                          className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={imageUrl}
                            alt={file.fileName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {(!project.files || project.files.length === 0) && selectedFiles.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p>No photos yet</p>
              </div>
            )}
          </TabsContent>

          {/* Comments Tab */}
          <TabsContent value="comments" className="flex-1 flex flex-col p-4 overflow-hidden">
            {/* Comment Input */}
            <Card className="mb-4 flex-shrink-0">
              <CardContent className="p-3">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    onClick={handleComment}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    size="sm"
                  >
                    {commentMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Comments List */}
            <div className="flex-1 overflow-auto space-y-3">
              {project.comments && project.comments.length > 0 ? (
                project.comments.map((comment: any) => (
                  <Card key={comment.id}>
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {format(new Date(comment.createdAt), 'd MMM yyyy HH:mm', { locale: ru })}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p>No comments yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Image Viewer Modal */}
      <ImageViewer
        src={viewerImage?.src || ''}
        alt={viewerImage?.alt || ''}
        isOpen={!!viewerImage}
        onClose={() => setViewerImage(null)}
      />
    </WorkerLayout>
  );
}
