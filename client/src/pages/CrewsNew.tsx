import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Phone, Edit, Trash2, Archive, Settings, MapPin, User, Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertCrewSchema, insertCrewMemberSchema, type Crew, type CrewMember } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/Layout/MainLayout';
import { apiRequest } from '@/lib/queryClient';

// Схема для простого редактирования бригады
const editCrewSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  leaderName: z.string().min(1, 'Руководитель обязателен'),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'vacation', 'equipment_issue', 'unavailable']).default('active'),
});

// Компонент формы редактирования
function EditCrewForm({ crew, onUpdate }: { crew: Crew, onUpdate: any }) {
  const editForm = useForm<z.infer<typeof editCrewSchema>>({
    resolver: zodResolver(editCrewSchema),
    defaultValues: {
      name: crew.name,
      leaderName: crew.leaderName,
      phone: crew.phone || '',
      address: crew.address || '',
      status: crew.status || 'active',
    },
  });

  const onSubmit = (data: z.infer<typeof editCrewSchema>) => {
    onUpdate.mutate(data);
  };

  return (
    <Form {...editForm}>
      <form onSubmit={editForm.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={editForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Название бригады</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={editForm.control}
          name="leaderName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Руководитель</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={editForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Телефон</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={editForm.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Адрес</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={editForm.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Статус</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Активна</SelectItem>
                  <SelectItem value="vacation">В отпуске</SelectItem>
                  <SelectItem value="equipment_issue">Проблемы с техникой</SelectItem>
                  <SelectItem value="unavailable">Недоступна</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex space-x-2">
          <Button type="submit" disabled={onUpdate.isPending} className="flex-1">
            {onUpdate.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

const extendedCrewSchema = insertCrewSchema.extend({
  members: z.array(z.object({
    firstName: z.string().min(1, 'Имя обязательно'),
    lastName: z.string().min(1, 'Фамилия обязательна'),
    address: z.string().min(1, 'Адрес обязателен'),
    uniqueNumber: z.string().min(1, 'Уникальный номер обязателен'),
    phone: z.string().optional(),
    role: z.enum(['leader', 'worker', 'specialist']).default('worker'),
  })).min(1, 'Нужен хотя бы один участник'),
});

type ExtendedCrewForm = z.infer<typeof extendedCrewSchema>;

export default function CrewsNew() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingMembers, setViewingMembers] = useState<number | null>(null);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: crews = [], isLoading } = useQuery<Crew[]>({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/crews?firmId=${selectedFirmId}`);
      return await response.json();
    },
    enabled: !!selectedFirmId,
    refetchInterval: 30000,
  });

  const { data: crewMembers = [], isLoading: membersLoading } = useQuery<CrewMember[]>({
    queryKey: ['/api/crew-members', viewingMembers],
    queryFn: async () => {
      const response = await fetch(`/api/crew-members?crewId=${viewingMembers}`);
      return await response.json();
    },
    enabled: !!viewingMembers,
  });

  const form = useForm<ExtendedCrewForm>({
    resolver: zodResolver(extendedCrewSchema),
    defaultValues: {
      firmId: selectedFirmId,
      name: '',
      uniqueNumber: '',
      leaderName: '',
      phone: '',
      address: '',
      members: [
        {
          firstName: '',
          lastName: '',
          address: '',
          uniqueNumber: '',
          phone: '',
          role: 'leader',
        }
      ],
    },
  });

  const createCrewMutation = useMutation({
    mutationFn: async (data: ExtendedCrewForm) => {
      const response = await apiRequest('/api/crews', 'POST', {
        ...data,
        firmId: selectedFirmId,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crews', selectedFirmId] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Бригада создана',
        description: 'Новая бригада успешно добавлена в систему',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка создания бригады',
        description: error.message || 'Не удалось создать бригаду',
        variant: 'destructive',
      });
    },
  });

  const updateCrewMutation = useMutation({
    mutationFn: async (data: { name: string; leaderName: string; phone?: string; address?: string; status?: string }) => {
      const response = await apiRequest(`/api/crews/${editingCrew?.id}`, 'PUT', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crews', selectedFirmId] });
      setIsEditDialogOpen(false);
      setEditingCrew(null);
      toast({
        title: 'Бригада обновлена',
        description: 'Изменения успешно сохранены',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка обновления',
        description: error.message || 'Не удалось обновить бригаду',
        variant: 'destructive',
      });
    },
  });



  const addMember = () => {
    const currentMembers = form.getValues('members');
    form.setValue('members', [
      ...currentMembers,
      {
        firstName: '',
        lastName: '',
        address: '',
        uniqueNumber: `WRK-${String(Date.now()).slice(-4)}`,
        phone: '',
        role: 'worker',
      }
    ]);
  };

  const removeMember = (index: number) => {
    const currentMembers = form.getValues('members');
    if (currentMembers.length > 1) {
      form.setValue('members', currentMembers.filter((_, i) => i !== index));
    }
  };

  const generateUniqueNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    form.setValue('uniqueNumber', `BR-${timestamp}`);
  };

  const onSubmit = (data: ExtendedCrewForm) => {
    createCrewMutation.mutate({
      ...data,
      firmId: selectedFirmId,
    });
  };

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Выберите фирму</h3>
            <p className="text-gray-500">Для управления бригадами необходимо выбрать фирму</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Управление бригадами</h1>
            <p className="text-gray-600">Команды для выполнения проектов установки солнечных панелей</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Создать бригаду
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Создание новой бригады</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Основная информация о бригаде */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Название бригады</FormLabel>
                          <FormControl>
                            <Input placeholder="Например: Бригада установки А" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uniqueNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Уникальный номер</FormLabel>
                          <div className="flex space-x-2">
                            <FormControl>
                              <Input placeholder="BR-001234" {...field} />
                            </FormControl>
                            <Button type="button" variant="outline" onClick={generateUniqueNumber}>
                              Генерировать
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="leaderName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Руководитель бригады</FormLabel>
                          <FormControl>
                            <Input placeholder="Полное имя руководителя" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Телефон</FormLabel>
                          <FormControl>
                            <Input placeholder="+49 xxx xxx xxxx" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес бригады</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Рабочий адрес или база" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Участники бригады */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Участники бригады</h3>
                      <Button type="button" variant="outline" size="sm" onClick={addMember}>
                        <Plus className="h-4 w-4 mr-2" />
                        Добавить участника
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {form.watch('members').map((member, index) => (
                        <Card key={index} className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium">Участник {index + 1}</h4>
                            {form.watch('members').length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMember(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name={`members.${index}.firstName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Имя</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Имя" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`members.${index}.lastName`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Фамилия</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Фамилия" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`members.${index}.uniqueNumber`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Уникальный номер</FormLabel>
                                  <FormControl>
                                    <Input placeholder="WRK-0001" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`members.${index}.phone`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Телефон</FormLabel>
                                  <FormControl>
                                    <Input placeholder="+49 xxx xxx xxxx" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name={`members.${index}.role`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Роль</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Выберите роль" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="leader">Руководитель</SelectItem>
                                      <SelectItem value="worker">Рабочий</SelectItem>
                                      <SelectItem value="specialist">Специалист</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name={`members.${index}.address`}
                            render={({ field }) => (
                              <FormItem className="mt-4">
                                <FormLabel>Адрес</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Адрес проживания" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={createCrewMutation.isPending}>
                      {createCrewMutation.isPending ? 'Создание...' : 'Создать бригаду'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Список бригад */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {crews.map((crew) => (
              <Card key={crew.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center">
                        {crew.name}
                        <Badge variant="secondary" className="ml-2">
                          {crew.uniqueNumber}
                        </Badge>
                      </CardTitle>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          {crew.leaderName}
                        </span>
                        {crew.phone && (
                          <span className="flex items-center">
                            <Phone className="h-4 w-4 mr-1" />
                            {crew.phone}
                          </span>
                        )}
                        {crew.address && (
                          <span className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            {crew.address}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
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
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingMembers(crew.id)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Участники
                    </Button>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingCrew(crew);
                        setIsEditDialogOpen(true);
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {crews.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Нет бригад</h3>
                <p className="text-gray-500">Создайте первую бригаду для начала работы</p>
              </div>
            )}
          </div>
        )}

        {/* Диалог редактирования бригады */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Редактировать бригаду</DialogTitle>
            </DialogHeader>
            {editingCrew && <EditCrewForm crew={editingCrew} onUpdate={updateCrewMutation} />}
          </DialogContent>
        </Dialog>

        {/* Модальное окно участников */}
        <Dialog open={!!viewingMembers} onOpenChange={() => setViewingMembers(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Участники бригады</DialogTitle>
            </DialogHeader>
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {crewMembers.map((member) => (
                  <Card key={member.id} className="p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">
                          {member.firstName} {member.lastName}
                        </h4>
                        <div className="text-sm text-gray-500 space-y-1">
                          <p>Номер: {member.uniqueNumber}</p>
                          <p>Роль: {member.role === 'leader' ? 'Руководитель' : member.role === 'specialist' ? 'Специалист' : 'Рабочий'}</p>
                          {member.phone && <p>Телефон: {member.phone}</p>}
                          {member.address && <p>Адрес: {member.address}</p>}
                        </div>
                      </div>
                      <Badge variant={member.role === 'leader' ? 'default' : 'secondary'}>
                        {member.role === 'leader' ? 'Руководитель' : member.role === 'specialist' ? 'Специалист' : 'Рабочий'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}