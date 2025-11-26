import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  File,
  Receipt,
  Eye,
  ExternalLink,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { getAccessToken, getAuthHeaders } from '@/lib/queryClient';

interface FileListProps {
  projectId: number;
}

interface FileRecord {
  id: number;
  projectId: number;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
}

interface PreviewFile {
  id: number;
  fileName: string;
  fileType: string;
  url: string;
}

export function FileList({ projectId }: FileListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [zoom, setZoom] = useState(1);

  const { data: files = [], isLoading, error } = useQuery<FileRecord[]>({
    queryKey: ['/api/files/project', projectId],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/files/project/${projectId}`, {
        headers: authHeaders,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка загрузки файлов');
      }

      return response.json();
    },
  });

  // Генерируем URL с токеном для изображений
  useEffect(() => {
    const generateImageUrls = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const urls: Record<number, string> = {};
      for (const file of files) {
        if (isImageFile(file.fileName, file.fileType)) {
          urls[file.id] = `/api/files/${file.id}?token=${encodeURIComponent(token)}`;
        }
      }
      setImageUrls(urls);
    };

    if (files.length > 0) {
      generateImageUrls();
    }
  }, [files]);

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: authHeaders,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка удаления файла');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Файл успешно удален',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const isImageFile = (fileName: string, fileType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return fileType.startsWith('image/') ||
           ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension || '');
  };

  const isPdfFile = (fileName: string, fileType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return fileType === 'application/pdf' || extension === 'pdf';
  };

  const getFileIcon = (fileName: string, fileType: string) => {
    if (isPdfFile(fileName, fileType)) {
      return <Receipt className="w-4 h-4 text-purple-600" />;
    }

    if (isImageFile(fileName, fileType)) {
      return <ImageIcon className="w-4 h-4 text-green-600" />;
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    if (['doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="w-4 h-4 text-blue-600" />;
    }

    return <File className="w-4 h-4 text-gray-600" />;
  };

  const getCategoryLabel = (fileType: string) => {
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.startsWith('image/')) return 'Изображение';
    return 'Файл';
  };

  const getCategoryColor = (fileType: string) => {
    if (fileType === 'application/pdf') return 'bg-purple-100 text-purple-800';
    if (fileType.startsWith('image/')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handlePreview = async (file: FileRecord) => {
    const token = await getAccessToken();
    if (!token) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка авторизации. Пожалуйста, войдите снова.',
        variant: 'destructive',
      });
      return;
    }

    const url = `/api/files/${file.id}?token=${encodeURIComponent(token)}`;

    setPreviewFile({
      id: file.id,
      fileName: file.fileName,
      fileType: file.fileType,
      url
    });
    setZoom(1);
  };

  const handleOpenInNewTab = async (fileId: number) => {
    const token = await getAccessToken();
    if (!token) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка авторизации. Пожалуйста, войдите снова.',
        variant: 'destructive',
      });
      return;
    }

    const url = `/api/files/${fileId}?token=${encodeURIComponent(token)}`;
    window.open(url, '_blank');
  };

  const handleDownload = async (fileId: number, fileName: string) => {
    const token = await getAccessToken();
    if (!token) {
      toast({
        title: 'Ошибка',
        description: 'Ошибка авторизации. Пожалуйста, войдите снова.',
        variant: 'destructive',
      });
      return;
    }

    const url = `/api/files/${fileId}?token=${encodeURIComponent(token)}`;

    // Создаем ссылку для скачивания
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (fileId: number) => {
    if (confirm('Вы уверены, что хотите удалить этот файл?')) {
      deleteMutation.mutate(fileId.toString());
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setZoom(1);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">Загрузка файлов...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-500">Ошибка загрузки файлов</p>
        </CardContent>
      </Card>
    );
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Файлы проекта</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">Файлы не найдены</p>
        </CardContent>
      </Card>
    );
  }

  // Разделяем файлы на изображения и остальные
  const imageFiles = files.filter(f => isImageFile(f.fileName, f.fileType));
  const otherFiles = files.filter(f => !isImageFile(f.fileName, f.fileType));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Файлы проекта ({files.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Галерея изображений */}
          {imageFiles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Изображения ({imageFiles.length})
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {imageFiles.map((file) => (
                  <div
                    key={file.id}
                    className="relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                    onClick={() => handlePreview(file)}
                  >
                    {imageUrls[file.id] ? (
                      <img
                        src={imageUrls[file.id]}
                        alt={file.fileName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      </div>
                    )}

                    {/* Overlay с действиями */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(file);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenInNewTab(file.id);
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(file.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Имя файла */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white truncate">{file.fileName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Список остальных файлов */}
          {otherFiles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Документы ({otherFiles.length})
              </h4>
              <div className="space-y-2">
                {otherFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(file.fileName, file.fileType)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-gray-900 truncate text-sm">
                            {file.fileName}
                          </p>
                          <Badge className={`${getCategoryColor(file.fileType)} text-xs`}>
                            {getCategoryLabel(file.fileType)}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-500">
                          {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {isPdfFile(file.fileName, file.fileType) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(file)}
                          title="Предпросмотр"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenInNewTab(file.id)}
                        title="Открыть в новой вкладке"
                        className="h-8 w-8 p-0"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownload(file.id, file.fileName)}
                        title="Скачать"
                        className="h-8 w-8 p-0"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(file.id)}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Модальное окно предпросмотра */}
      <Dialog open={!!previewFile} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b flex flex-row items-center justify-between">
            <DialogTitle className="truncate pr-4">
              {previewFile?.fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {previewFile && isImageFile(previewFile.fileName, previewFile.fileType) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(z => Math.min(3, z + 0.25))}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => previewFile && handleOpenInNewTab(previewFile.id)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Открыть
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => previewFile && handleDownload(previewFile.id, previewFile.fileName)}
              >
                <Download className="w-4 h-4 mr-1" />
                Скачать
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto bg-gray-900 flex items-center justify-center min-h-[400px] max-h-[calc(90vh-80px)]">
            {previewFile && isImageFile(previewFile.fileName, previewFile.fileType) && (
              <img
                src={previewFile.url}
                alt={previewFile.fileName}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{ transform: `scale(${zoom})` }}
              />
            )}

            {previewFile && isPdfFile(previewFile.fileName, previewFile.fileType) && (
              <iframe
                src={previewFile.url}
                className="w-full h-full min-h-[600px]"
                title={previewFile.fileName}
              />
            )}

            {previewFile && !isImageFile(previewFile.fileName, previewFile.fileType) &&
             !isPdfFile(previewFile.fileName, previewFile.fileType) && (
              <div className="text-center text-white p-8">
                <File className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Предпросмотр недоступен</p>
                <p className="text-sm text-gray-400 mb-4">
                  Этот тип файла не поддерживает предпросмотр
                </p>
                <Button
                  onClick={() => previewFile && handleOpenInNewTab(previewFile.id)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Открыть в новой вкладке
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
