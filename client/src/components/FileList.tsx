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
  fileId: string;
  originalName: string;
  size: number;
  category: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByUser?: {
    firstName: string;
    lastName: string;
  };
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

  const getFileIcon = (fileName: string, category: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    // Иконка по категории
    switch (category) {
      case 'image':
        return <Image className="w-4 h-4 text-green-600" />;
      case 'report':
        return <ClipboardList className="w-4 h-4 text-blue-600" />;
      case 'invoice':
        return <Receipt className="w-4 h-4 text-purple-600" />;
      case 'project_file':
        return <Folder className="w-4 h-4 text-orange-600" />;
      default:
        break;
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

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'project_file': 'Файл проекта',
      'document': 'Документ',
      'image': 'Изображение',
      'report': 'Отчет',
      'invoice': 'Счет'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'project_file': 'bg-orange-100 text-orange-800',
      'document': 'bg-gray-100 text-gray-800',
      'image': 'bg-green-100 text-green-800',
      'report': 'bg-blue-100 text-blue-800',
      'invoice': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

  const handleDownload = (fileId: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = `/api/files/${fileId}`;
    link.download = fileName;
    link.click();
  };

  const handleDelete = (fileId: string) => {
    if (confirm('Вы уверены, что хотите удалить этот файл?')) {
      deleteMutation.mutate(fileId);
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
                {getFileIcon(file.originalName, file.category)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-900 truncate">
                      {file.originalName}
                    </p>
                    <Badge className={getCategoryColor(file.category)}>
                      {getCategoryLabel(file.category)}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                    {file.uploadedByUser && (
                      <span>
                        {file.uploadedByUser.firstName} {file.uploadedByUser.lastName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDownload(file.fileId, file.originalName)}
                >
                  <Download className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(file.fileId)}
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