import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Crew } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Phone, Users, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const crewSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  leaderName: z.string().min(1, 'Руководитель бригады обязателен'),
  phone: z.string().optional(),
  status: z.enum(['active', 'vacation', 'equipment_issue', 'unavailable']).default('active'),
});

export default function Crews() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);

  const form = useForm<z.infer<typeof crewSchema>>({
    resolver: zodResolver(crewSchema),
    defaultValues: {
      name: '',
      leaderName: '',
      phone: '',
      status: 'active',
    },
  });

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: crews = [], isLoading } = useQuery<Crew[]>({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/crews?firmId=${selectedFirmId}`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const createCrewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof crewSchema>) => {
      const response = await apiRequest('/api/crews', 'POST', {
        ...data,
        firmId: selectedFirmId,
        uniqueNumber: `CREW-${Date.now()}`, // Generate unique number
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успех',
        description: editingCrew ? 'Бригада успешно обновлена' : 'Бригада успешно создана',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
      setIsDialogOpen(false);
      setEditingCrew(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateCrewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof crewSchema>) => {
      const response = await apiRequest(`/api/crews/${editingCrew.id}`, 'PUT', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успех',
        description: 'Бригада успешно обновлена',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
      setIsDialogOpen(false);
      setEditingCrew(null);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async (crewId: number) => {
      const response = await apiRequest(`/api/crews/${crewId}`, 'DELETE');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успех',
        description: 'Бригада успешно удалена',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof crewSchema>) => {
    if (editingCrew) {
      updateCrewMutation.mutate(data);
    } else {
      createCrewMutation.mutate(data);
    }
  };

  const openEditDialog = (crew: any) => {
    console.log('🚀 Opening edit dialog for crew:', crew);
    console.log('📊 Current dialog state:', isDialogOpen);
    console.log('📋 Current editing crew:', editingCrew);
    
    setEditingCrew(crew);
    
    const formData = {
      name: crew.name,
      leaderName: crew.leaderName,
      phone: crew.phone || '',
      status: crew.status || 'active',
    };
    
    console.log('📝 Setting form data:', formData);
    form.reset(formData);
    setIsDialogOpen(true);
    console.log('✅ Dialog should be opened now');
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCrew(null);
    form.reset({
      name: '',
      leaderName: '',
      phone: '',
      status: 'active',
    });
  };

  const handleDeleteCrew = (crewId: number) => {
    if (confirm('Вы уверены, что хотите удалить эту бригаду? Это действие нельзя отменить.')) {
      deleteCrewMutation.mutate(crewId);
    }
  };

  const filteredCrews = showArchived 
    ? crews 
    : crews.filter((crew) => !crew.archived);

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {t('crews')}
          </h1>
          <p className="text-gray-600">
            Пожалуйста, выберите фирму в заголовке для управления бригадами.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('crews')}</h1>
            <p className="text-gray-600 mt-1">Управление бригадами установки</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                id="show-archived"
              />
              <Label htmlFor="show-archived" className="text-sm">
                Показать архивированные
              </Label>
            </div>
            <Button className="bg-primary hover:bg-primary-dark text-white" onClick={() => {
              setEditingCrew(null);
              form.reset({
                name: '',
                leaderName: '',
                phone: '',
                status: 'active',
              });
              setIsDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить новую бригаду
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingCrew(null);
                form.reset({
                  name: '',
                  leaderName: '',
                  phone: '',
                  status: 'active',
                });
              }
            }}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingCrew ? 'Редактировать бригаду' : 'Добавить новую бригаду'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Название бригады</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="z.B. Team Alpha"
                    />
                    {form.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="leaderName">Brigadeführer</Label>
                    <Input
                      id="leaderName"
                      {...form.register('leaderName')}
                      placeholder="Vollständiger Name"
                    />
                    {form.formState.errors.leaderName && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.leaderName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">{t('phone')}</Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="+49 123 456789"
                    />
                  </div>

                  <div>
                    <Label htmlFor="status">Статус бригады</Label>
                    <Select value={form.watch('status')} onValueChange={(value) => form.setValue('status', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Активна</SelectItem>
                        <SelectItem value="vacation">В отпуске</SelectItem>
                        <SelectItem value="equipment_issue">Проблемы с оборудованием</SelectItem>
                        <SelectItem value="unavailable">Недоступна</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      disabled={createCrewMutation.isPending || updateCrewMutation.isPending}
                      className="flex-1"
                    >
                      {(createCrewMutation.isPending || updateCrewMutation.isPending) ? 'Сохранение...' : (editingCrew ? 'Обновить' : 'Создать')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeDialog}
                      className="flex-1"
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brigade Name</TableHead>
                  <TableHead>Brigadeführer</TableHead>
                  <TableHead>{t('phone')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrews.map((crew: any) => (
                  <TableRow key={crew.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{crew.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{crew.leaderName}</div>
                    </TableCell>
                    <TableCell>
                      {crew.phone ? (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{crew.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        crew.status === 'active' ? 'default' :
                        crew.status === 'vacation' ? 'secondary' :
                        crew.status === 'equipment_issue' ? 'destructive' :
                        'outline'
                      }>
                        {crew.status === 'active' ? 'Активна' :
                         crew.status === 'vacation' ? 'В отпуске' :
                         crew.status === 'equipment_issue' ? 'Проблемы с техникой' :
                         'Недоступна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {new Date(crew.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            alert(`Edit button clicked for crew: ${crew.name}`);
                            console.log('🔥 Edit button clicked for crew:', crew);
                            openEditDialog(crew);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCrew(crew.id)}
                          disabled={deleteCrewMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
