import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Trash2, 
  FileText, 
  Image, 
  File, 
  Receipt, 
  ClipboardList,
  Folder
} from 'lucide-react';

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

export function FileList({ projectId }: FileListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files = [], isLoading, error } = useQuery<FileRecord[]>({
    queryKey: ['/api/files/project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/files/project/${projectId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка загрузки файлов');
      }

      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
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

  const getFileIcon = (fileName: string, fileType: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Иконка по типу файла
    if (fileType === 'application/pdf') {
      return <Receipt className="w-4 h-4 text-purple-600" />;
    }
    
    // Иконка по расширению файла
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <Image className="w-4 h-4 text-green-600" />;
    }
    
    if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="w-4 h-4 text-red-600" />;
    }
    
    return <File className="w-4 h-4 text-gray-600" />;
  };

  const getCategoryLabel = (fileType: string) => {
    if (fileType === 'application/pdf') return 'PDF документ';
    if (fileType.startsWith('image/')) return 'Изображение';
    return 'Файл';
  };

  const getCategoryColor = (fileType: string) => {
    if (fileType === 'application/pdf') return 'bg-purple-100 text-purple-800';
    if (fileType.startsWith('image/')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  // Для legacy файлов размер неизвестен
  const formatFileSize = () => {
    return 'Неизвестно';
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

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  const handleDelete = (fileId: number) => {
    if (confirm('Вы уверены, что хотите удалить этот файл?')) {
      deleteMutation.mutate(fileId.toString());
    }
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Файлы проекта ({files.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
            >
              <div className="flex items-center gap-3 flex-1">
                {getFileIcon(file.fileName, file.fileType)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900 truncate">
                      {file.fileName}
                    </p>
                    <Badge className={getCategoryColor(file.fileType)}>
                      {getCategoryLabel(file.fileType)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatFileSize()}</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(file.fileUrl, file.fileName)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(file.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}