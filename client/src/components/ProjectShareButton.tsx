import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Share, X, Eye, Edit } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface ProjectShare {
  id: number;
  projectId: number;
  sharedBy: string;
  sharedWith: string;
  permission: 'view' | 'edit';
  createdAt: string;
}

interface ProjectShareButtonProps {
  projectId: number;
  firmId: string;
}

export function ProjectShareButton({ projectId, firmId }: ProjectShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Получить список пользователей фирмы
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/firms', firmId, 'users'],
    queryFn: async () => {
      const response = await apiRequest(`/api/firms/${firmId}/users`);
      return await response.json();
    },
    enabled: open,
  });

  // Получить список текущих поделенных доступов
  const { data: shares = [], isLoading: sharesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'shares'],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects/${projectId}/shares`);
      return await response.json();
    },
    enabled: open,
  });

  // Мутация для предоставления доступа
  const shareProjectMutation = useMutation({
    mutationFn: async (data: { sharedWith: string; permission: 'view' | 'edit' }) => {
      const response = await apiRequest(`/api/projects/${projectId}/share`, 'POST', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'shares'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-history', projectId] });
      setSelectedUser('');
      setSelectedPermission('view');
      toast({
        title: 'Доступ предоставлен',
        description: 'Проект успешно предоставлен в совместный доступ',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось предоставить доступ к проекту',
        variant: 'destructive',
      });
    },
  });

  // Мутация для удаления доступа
  const removeShareMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest(`/api/projects/${projectId}/shares/${userId}`, 'DELETE');
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'shares'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-history', projectId] });
      toast({
        title: 'Доступ отозван',
        description: 'Совместный доступ к проекту был удален',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить доступ к проекту',
        variant: 'destructive',
      });
    },
  });

  const handleShare = () => {
    if (!selectedUser || selectedUser === 'loading' || selectedUser === 'no-users') {
      toast({
        title: 'Ошибка',
        description: 'Выберите пользователя для предоставления доступа',
        variant: 'destructive',
      });
      return;
    }

    shareProjectMutation.mutate({
      sharedWith: selectedUser,
      permission: selectedPermission,
    });
  };

  const getUserName = (userId: string) => {
    const user = users.find((u: User) => u.id === userId);
    if (!user) return userId;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || userId;
  };

  // Фильтрация пользователей - исключаем уже имеющих доступ
  const availableUsers = users.filter((user: User) => 
    !shares.some((share: ProjectShare) => share.sharedWith === user.id)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share className="w-4 h-4 mr-2" />
          Поделиться
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Совместный доступ к проекту</DialogTitle>
          <DialogDescription>
            Предоставьте другим сотрудникам доступ к просмотру или редактированию этого проекта
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* Форма добавления нового доступа */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">Пользователь</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пользователя" />
                </SelectTrigger>
                <SelectContent>
                  {usersLoading ? (
                    <SelectItem value="loading" disabled>
                      Загрузка...
                    </SelectItem>
                  ) : availableUsers.length === 0 ? (
                    <SelectItem value="no-users" disabled>
                      Нет доступных пользователей
                    </SelectItem>
                  ) : (
                    availableUsers.map((user: User) => (
                      <SelectItem key={user.id} value={user.id}>
                        {getUserName(user.id)} ({user.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="permission-select">Права доступа</Label>
              <Select value={selectedPermission} onValueChange={(value: 'view' | 'edit') => setSelectedPermission(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Только просмотр</SelectItem>
                  <SelectItem value="edit">Редактирование</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleShare} 
              disabled={!selectedUser || shareProjectMutation.isPending}
              className="w-full"
            >
              {shareProjectMutation.isPending ? 'Предоставление доступа...' : 'Предоставить доступ'}
            </Button>
          </div>

          {/* Список текущих доступов */}
          {!sharesLoading && shares.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Текущие доступы:</h4>
              <div className="space-y-2">
                {shares.map((share: ProjectShare) => (
                  <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="font-medium text-sm">
                          {getUserName(share.sharedWith)}
                        </div>
                        <div className="flex items-center space-x-2">
                          {share.permission === 'edit' ? (
                            <Badge variant="secondary" className="text-xs">
                              <Edit className="w-3 h-3 mr-1" />
                              Редактирование
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <Eye className="w-3 h-3 mr-1" />
                              Просмотр
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShareMutation.mutate(share.sharedWith)}
                      disabled={removeShareMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}