import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Image, File } from 'lucide-react';
import { getAuthHeaders } from '@/lib/queryClient';

interface FileUploadProps {
  projectId?: number;
  onFileUploaded?: (file: any) => void;
}

export function FileUpload({ projectId, onFileUploaded }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('document');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const authHeaders = await getAuthHeaders();
      // For FormData, pass authHeaders directly (browser will add Content-Type with boundary)
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Ошибка загрузки файла');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Успешно',
        description: 'Файл успешно загружен',
      });
      
      setSelectedFile(null);
      setCategory('document');
      
      // Обновляем кэш файлов проекта
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/files/project', projectId] });
      }
      
      if (onFileUploaded) {
        onFileUploaded(data);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleUpload = () => {
    if (!selectedFile) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, выберите файл',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('category', category);
    
    if (projectId) {
      formData.append('projectId', projectId.toString());
    }

    uploadMutation.mutate(formData);
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '')) {
      return <Image className="w-4 h-4" />;
    }
    
    if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
      return <FileText className="w-4 h-4" />;
    }
    
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Загрузка файла
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-input">Выберите файл</Label>
          <Input
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.xls,.xlsx"
            className="mt-1"
          />
          {selectedFile && (
            <div className="mt-2 p-2 bg-gray-50 rounded border">
              <div className="flex items-center gap-2">
                {getFileIcon(selectedFile.name)}
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {formatFileSize(selectedFile.size)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="category">Категория файла</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Выберите категорию" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project_file">Файл проекта</SelectItem>
              <SelectItem value="document">Документ</SelectItem>
              <SelectItem value="image">Изображение</SelectItem>
              <SelectItem value="report">Отчет</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || uploadMutation.isPending}
          className="w-full"
        >
          {uploadMutation.isPending ? 'Загрузка...' : 'Загрузить файл'}
        </Button>
      </CardContent>
    </Card>
  );
}