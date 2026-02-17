import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileUpload } from '@/components/FileUpload';
import { FileList } from '@/components/FileList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HardDrive, Upload, List, FolderOpen } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Project {
  id: number;
  teamNumber: string | null;
  status: string;
  clientId: number;
}

export function FileStorage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', selectedFirmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?firmId=${selectedFirmId}`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <HardDrive className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Файловое хранилище</h1>
          <p className="text-gray-600">Управление документами и файлами проектов</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Выбор проекта
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="project-select">Проект</Label>
            <Select 
              value={selectedProjectId?.toString() || ''} 
              onValueChange={(value) => setSelectedProjectId(value ? parseInt(value) : null)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Выберите проект для работы с файлами" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.teamNumber || `PROJ-${project.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedProjectId && (
        <Tabs defaultValue="files" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Файлы проекта
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Загрузка файлов
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <FileList projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="upload">
            <FileUpload 
              projectId={selectedProjectId} 
              onFileUploaded={() => {
                // Переключаемся на вкладку со списком файлов после загрузки
                const filesTab = document.querySelector('[value="files"]') as HTMLElement;
                if (filesTab) {
                  filesTab.click();
                }
              }}
            />
          </TabsContent>
        </Tabs>
      )}

      {!selectedProjectId && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Выберите проект</p>
              <p>Для работы с файлами выберите проект из списка выше</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}