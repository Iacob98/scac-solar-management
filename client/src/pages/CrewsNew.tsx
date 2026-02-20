import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Users, Phone, Edit, Trash2, Archive, Settings, MapPin, User, Building2, BarChart, Calendar, CheckCircle, Key, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { insertCrewSchema, insertCrewMemberSchema, type Crew, type CrewMember } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/Layout/MainLayout';
import { CrewHistory } from '@/components/CrewHistory';
import { apiRequest, getAuthHeaders } from '@/lib/queryClient';
import { useLocation } from 'wouter';

// Компонент для управления PIN-кодом работника
function WorkerPinManager({ member, onPinChange }: { member: CrewMember; onPinChange: () => void }) {
  const { toast } = useToast();
  const [showPin, setShowPin] = useState(false);
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  // Check if member has email
  const hasEmail = !!member.memberEmail;
  // Check if member has PIN (we'll need to fetch this status)
  const [pinStatus, setPinStatus] = useState<{ hasPin: boolean; pinCreatedAt?: string } | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Fetch PIN status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`/api/worker-auth/member-status/${member.id}`, {
          headers: authHeaders,
        });
        if (response.ok) {
          const data = await response.json();
          setPinStatus(data);
        }
      } catch (error) {
        console.error('Error fetching PIN status:', error);
      } finally {
        setIsLoadingStatus(false);
      }
    };
    fetchStatus();
  }, [member.id]);

  const handleGeneratePin = async () => {
    if (!hasEmail) {
      toast({
        title: 'Email обязателен',
        description: 'Для генерации PIN необходимо указать email участника',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/worker-auth/generate-pin', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: member.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate PIN');
      }

      const data = await response.json();
      setGeneratedPin(data.pin);
      setShowPin(true);
      setPinStatus({ hasPin: true, pinCreatedAt: new Date().toISOString() });
      onPinChange();

      toast({
        title: 'PIN сгенерирован',
        description: `PIN для ${member.firstName} ${member.lastName}: ${data.pin}`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokePin = async () => {
    if (!confirm(`Отозвать доступ для ${member.firstName} ${member.lastName}? Работник больше не сможет войти в портал.`)) {
      return;
    }

    setIsRevoking(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch('/api/worker-auth/revoke-pin', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: member.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to revoke PIN');
      }

      setPinStatus({ hasPin: false });
      setGeneratedPin(null);
      onPinChange();

      toast({
        title: 'Доступ отозван',
        description: `PIN для ${member.firstName} ${member.lastName} деактивирован`,
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: 'PIN скопирован в буфер обмена',
    });
  };

  if (isLoadingStatus) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Проверка...
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-500">Портал работника:</span>
          {pinStatus?.hasPin ? (
            <Badge variant="default" className="text-xs bg-green-100 text-green-700">
              Активен
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Неактивен
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {pinStatus?.hasPin ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={handleGeneratePin}
                disabled={isGenerating || !hasEmail}
                title="Сгенерировать новый PIN"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Key className="h-3 w-3 mr-1" />
                    Новый PIN
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-red-600 hover:text-red-700"
                onClick={handleRevokePin}
                disabled={isRevoking}
                title="Отозвать доступ"
              >
                {isRevoking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  'Отозвать'
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleGeneratePin}
              disabled={isGenerating || !hasEmail}
              title={hasEmail ? 'Сгенерировать PIN' : 'Для генерации PIN необходимо указать email'}
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Key className="h-3 w-3 mr-1" />
              )}
              Сгенерировать PIN
            </Button>
          )}
        </div>
      </div>

      {/* Show generated PIN */}
      {generatedPin && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-700">PIN для входа:</span>
              <code className="text-sm font-mono font-bold text-green-800">
                {showPin ? generatedPin : '••••••'}
              </code>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(generatedPin)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Сохраните этот PIN! После закрытия он не будет показан снова.
          </p>
        </div>
      )}

      {!hasEmail && (
        <p className="text-xs text-amber-600 mt-1">
          Для активации доступа к порталу необходимо указать email участника
        </p>
      )}
    </div>
  );
}

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
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [editingMember, setEditingMember] = useState<CrewMember | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Форма для добавления/редактирования участника
  const memberSchema = z.object({
    firstName: z.string().min(1, 'Имя обязательно'),
    lastName: z.string().min(1, 'Фамилия обязательна'),
    address: z.string().min(1, 'Адрес обязателен'),
    uniqueNumber: z.string().min(1, 'Уникальный номер обязателен'),
    phone: z.string().optional(),
    memberEmail: z.string().email('Неверный формат email').optional().or(z.literal('')),
    role: z.enum(['leader', 'worker', 'specialist']).default('worker'),
  });

  const memberForm = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      address: '',
      uniqueNumber: `WRK-${Date.now().toString().slice(-4)}`,
      phone: '',
      memberEmail: '',
      role: 'worker',
    },
  });

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

  // Загрузка участников бригады
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const response = await fetch(`/api/crew-members?crewId=${crew.id}`, {
          headers: authHeaders,
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const members = await response.json();
        setCrewMembers(Array.isArray(members) ? members : []);
      } catch (error) {
        console.error('Error fetching crew members:', error);
        setCrewMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };
    fetchMembers();
  }, [crew.id]);

  const onSubmit = (data: z.infer<typeof editCrewSchema>) => {
    onUpdate.mutate(data);
  };

  // Мутация для обновления участника
  const updateMemberMutation = useMutation({
    mutationFn: async ({ memberId, data }: { memberId: number, data: z.infer<typeof memberSchema> }) => {
      const response = await apiRequest(`/api/crew-members/${memberId}`, 'PUT', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: 'Участник обновлен', description: 'Данные участника успешно изменены' });
      memberForm.reset();
      setEditingMember(null);
      setShowAddMemberForm(false);
      refreshMembers();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  // Функция для обновления списка участников
  const refreshMembers = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/crew-members?crewId=${crew.id}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const members = await response.json();
      setCrewMembers(Array.isArray(members) ? members : []);
    } catch (error) {
      console.error('Error refreshing members:', error);
      setCrewMembers([]);
    }
  };

  // Мутация для добавления участника
  const addMemberMutation = useMutation({
    mutationFn: async (data: z.infer<typeof memberSchema>) => {
      const response = await apiRequest('/api/crew-members', 'POST', { ...data, crewId: crew.id });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: 'Участник добавлен', description: 'Новый участник добавлен в бригаду' });
      memberForm.reset({
        firstName: '',
        lastName: '',
        address: '',
        uniqueNumber: `WRK-${Date.now().toString().slice(-4)}`,
        phone: '',
        memberEmail: '',
        role: 'worker',
      });
      setShowAddMemberForm(false);
      // Принудительно обновляем кеш для участников бригады
      queryClient.invalidateQueries({ queryKey: ['/api/crew-members', crew.id] });
      // Также обновляем историю бригады
      queryClient.invalidateQueries({ queryKey: ['crew-history', crew.id] });
      refreshMembers();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  // Мутация для удаления участника
  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: number) => {
      const response = await apiRequest(`/api/crew-members/${memberId}`, 'DELETE');
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: 'Участник удален', description: 'Участник удален из бригады' });
      // Принудительно обновляем кеш для участников бригады
      queryClient.invalidateQueries({ queryKey: ['/api/crew-members', crew.id] });
      // Также обновляем историю бригады
      queryClient.invalidateQueries({ queryKey: ['crew-history', crew.id] });
      refreshMembers();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div>
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
      
      <div className="mt-6 border-t pt-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Участники бригады</h3>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => {
              memberForm.reset({
                firstName: '',
                lastName: '',
                address: '',
                uniqueNumber: `WRK-${Date.now().toString().slice(-4)}`,
                phone: '',
                role: 'worker',
              });
              setEditingMember(null);
              setShowAddMemberForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>

        {/* Форма добавления/редактирования участника */}
        {showAddMemberForm && (
          <Card className="mb-4 p-4">
            <Form {...memberForm}>
              <form onSubmit={memberForm.handleSubmit((data) => {
                if (editingMember) {
                  updateMemberMutation.mutate({ memberId: editingMember.id, data });
                } else {
                  addMemberMutation.mutate(data);
                }
              })} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={memberForm.control}
                    name="firstName"
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
                    control={memberForm.control}
                    name="lastName"
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
                </div>
                
                <FormField
                  control={memberForm.control}
                  name="uniqueNumber"
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
                  control={memberForm.control}
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
                
                <FormField
                  control={memberForm.control}
                  name="memberEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="user@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={memberForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Роль</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
                
                <FormField
                  control={memberForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Адрес</FormLabel>
                      <FormControl>
                        <Input placeholder="Адрес участника" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex space-x-2">
                  <Button 
                    type="submit" 
                    disabled={addMemberMutation.isPending || updateMemberMutation.isPending}
                    className="flex-1"
                  >
                    {addMemberMutation.isPending || updateMemberMutation.isPending 
                      ? 'Сохранение...' 
                      : editingMember 
                        ? 'Обновить' 
                        : 'Добавить'
                    }
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowAddMemberForm(false);
                      setEditingMember(null);
                      memberForm.reset();
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </form>
            </Form>
          </Card>
        )}
      
      {membersLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {crewMembers.map((member) => (
            <Card key={member.id} className="p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium">{member.firstName} {member.lastName}</div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>Номер: {member.uniqueNumber}</div>
                    <div>Роль: {member.role === 'leader' ? 'Руководитель' : member.role === 'specialist' ? 'Специалист' : 'Рабочий'}</div>
                    {member.phone && <div>Телефон: {member.phone}</div>}
                    {member.memberEmail && <div>Email: {member.memberEmail}</div>}
                    <div>Адрес: {member.address}</div>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingMember(member);
                      memberForm.reset({
                        firstName: member.firstName,
                        lastName: member.lastName,
                        address: member.address || '',
                        uniqueNumber: member.uniqueNumber,
                        phone: member.phone || '',
                        memberEmail: member.memberEmail || '',
                        role: (member.role as 'leader' | 'worker' | 'specialist') || 'worker',
                      });
                      setShowAddMemberForm(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => {
                      if (confirm(`Удалить участника ${member.firstName} ${member.lastName}?`)) {
                        deleteMemberMutation.mutate(member.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {/* Worker Portal PIN Management */}
              <WorkerPinManager member={member} onPinChange={refreshMembers} />
            </Card>
          ))}
          
          {crewMembers.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              В бригаде пока нет участников
            </div>
          )}
        </div>
      )}
        
      </div>
    </div>
  );
}

const extendedCrewSchema = insertCrewSchema.omit({ firmId: true }).extend({
  firmId: z.string().min(1, 'ID фирмы обязателен').optional(),
  members: z.array(z.object({
    firstName: z.string().min(1, 'Имя обязательно'),
    lastName: z.string().min(1, 'Фамилия обязательна'),
    address: z.string().optional().default(''),
    uniqueNumber: z.string().min(1, 'Уникальный номер обязателен'),
    phone: z.string().optional().default(''),
    memberEmail: z.string().email('Неверный формат email').optional().or(z.literal('')),
    role: z.enum(['leader', 'worker', 'specialist']).default('worker'),
  })).optional().default([]),
});

type ExtendedCrewForm = z.infer<typeof extendedCrewSchema>;

export default function CrewsNew() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingMembers, setViewingMembers] = useState<number | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: crews = [], isLoading } = useQuery<Crew[]>({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const timestamp = Date.now();
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/crews?firmId=${selectedFirmId}&_t=${timestamp}`, {
        cache: 'no-cache',
        headers: {
          ...authHeaders,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    },
    enabled: !!selectedFirmId,
    refetchInterval: 30000,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: crewMembers = [], isLoading: membersLoading } = useQuery<CrewMember[]>({
    queryKey: ['/api/crew-members', viewingMembers],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/crew-members?crewId=${viewingMembers}`, {
        headers: authHeaders,
      });
      return await response.json();
    },
    enabled: !!viewingMembers,
  });

  const form = useForm<ExtendedCrewForm>({
    resolver: zodResolver(extendedCrewSchema),
    mode: 'onChange',
    defaultValues: {
      firmId: selectedFirmId || '',
      name: '',
      uniqueNumber: '',
      leaderName: '',
      phone: '',
      address: '',
      members: [{
        firstName: '',
        lastName: '',
        address: '',
        uniqueNumber: `WRK-${Date.now().toString().slice(-4)}`,
        phone: '',
        role: 'worker',
        memberEmail: ''
      }],
    },
  });

  // Обновляем firmId когда selectedFirmId изменяется
  useEffect(() => {
    if (selectedFirmId) {
      form.setValue('firmId', selectedFirmId);
    }
  }, [selectedFirmId, form]);

  const createCrewMutation = useMutation({
    mutationFn: async (data: ExtendedCrewForm) => {
      const requestData = {
        ...data,
        firmId: selectedFirmId,
      };

      const response = await apiRequest('/api/crews', 'POST', requestData);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      // Инвалидируем запрос с правильным ключом
      queryClient.invalidateQueries({ queryKey: ['/api/crews', selectedFirmId] });
      queryClient.refetchQueries({ queryKey: ['/api/crews', selectedFirmId] });
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
        memberEmail: ''
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
    if (!selectedFirmId) {
      toast({
        title: 'Ошибка',
        description: 'Не выбрана фирма',
        variant: 'destructive',
      });
      return;
    }
    
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
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Управление бригадами</h1>
            <p className="text-sm sm:text-base text-gray-600">Команды для выполнения проектов установки солнечных панелей</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/crews/statistics')}
              className="w-full sm:w-auto"
            >
              <BarChart className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Статистика бригад</span>
              <span className="sm:hidden">Статистика</span>
            </Button>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Создать бригаду</span>
                  <span className="sm:hidden">Создать</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto mx-2">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">Создание новой бригады</DialogTitle>
                <DialogDescription className="text-sm">
                  Заполните информацию о новой бригаде и добавьте участников команды
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Основная информация о бригаде */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          <div className="flex flex-col sm:flex-row gap-2">
                            <FormControl>
                              <Input placeholder="BR-001234" {...field} />
                            </FormControl>
                            <Button type="button" variant="outline" onClick={generateUniqueNumber} size="sm" className="whitespace-nowrap">
                              Генерировать
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            <Input placeholder="+49 xxx xxx xxxx" {...field} value={field.value || ''} />
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
                          <Textarea placeholder="Рабочий адрес или база" {...field} value={field.value || ''} />
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
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base sm:text-lg flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="truncate">{crew.name}</span>
                        <Badge variant="secondary" className="self-start sm:self-center">
                          {crew.uniqueNumber}
                        </Badge>
                      </CardTitle>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs sm:text-sm text-gray-500 mt-2 gap-1 sm:gap-0">
                        <span className="flex items-center">
                          <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{crew.leaderName}</span>
                        </span>
                        {crew.phone && (
                          <span className="flex items-center">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{crew.phone}</span>
                          </span>
                        )}
                        {crew.address && (
                          <span className="flex items-center">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
                            <span className="truncate">{crew.address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Badge variant={
                        crew.status === 'active' ? 'default' :
                        crew.status === 'vacation' ? 'secondary' :
                        crew.status === 'equipment_issue' ? 'destructive' :
                        'outline'
                      } className="text-xs">
                        {crew.status === 'active' ? 'Активна' :
                         crew.status === 'vacation' ? 'В отпуске' :
                         crew.status === 'equipment_issue' ? 'Проблемы с техникой' :
                         'Недоступна'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingMembers(crew.id)}
                      className="w-full sm:w-auto"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Участники
                    </Button>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setExpandedHistory(expandedHistory === crew.id ? null : crew.id)}
                        className="w-full sm:w-auto"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">История</span>
                        <span className="sm:hidden">История изменений</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingCrew(crew);
                        setIsEditDialogOpen(true);
                      }} className="w-full sm:w-auto">
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </Button>
                    </div>
                  </div>
                  
                  {/* Компонент истории бригады */}
                  {expandedHistory === crew.id && (
                    <div className="border-t pt-4">
                      <CrewHistory crewId={crew.id} crewName={crew.name} />
                    </div>
                  )}
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
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-2">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Редактировать бригаду</DialogTitle>
            </DialogHeader>
            {editingCrew && <EditCrewForm crew={editingCrew} onUpdate={updateCrewMutation} />}
          </DialogContent>
        </Dialog>

        {/* Модальное окно участников */}
        <Dialog open={!!viewingMembers} onOpenChange={() => setViewingMembers(null)}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto mx-2">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl">Участники бригады</DialogTitle>
            </DialogHeader>
            {membersLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {crewMembers.map((member) => (
                  <Card key={member.id} className="p-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base">
                          {member.firstName} {member.lastName}
                        </h4>
                        <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                          <p>Номер: {member.uniqueNumber}</p>
                          <p>Роль: {member.role === 'leader' ? 'Руководитель' : member.role === 'specialist' ? 'Специалист' : 'Рабочий'}</p>
                          {member.phone && <p className="truncate">Телефон: {member.phone}</p>}
                          {member.memberEmail && <p className="truncate">Email: {member.memberEmail}</p>}
                          {member.address && <p className="truncate">Адрес: {member.address}</p>}
                        </div>
                      </div>
                      <Badge variant={member.role === 'leader' ? 'default' : 'secondary'} className="text-xs self-start">
                        {member.role === 'leader' ? 'Руководитель' : member.role === 'specialist' ? 'Специалист' : 'Рабочий'}
                      </Badge>
                    </div>
                    {/* Worker Portal PIN Management */}
                    <WorkerPinManager
                      member={member}
                      onPinChange={() => queryClient.invalidateQueries({ queryKey: ['/api/crew-members', viewingMembers] })}
                    />
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