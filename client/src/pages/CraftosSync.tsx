import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { CraftosAppointment } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  RefreshCw, Settings, Trash2, Plus, Search, CalendarClock,
  ExternalLink, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  Clock, Users, FolderPlus, Eye, Wifi, WifiOff, Calendar, MapPin, Phone, User
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// --- Types ---
interface CraftosConfig {
  id: number;
  firmId: number;
  email: string;
  enabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  createdAt: string;
}

interface SyncResult {
  message: string;
  newCount: number;
  updatedCount: number;
  dateChanges: number;
  statusChanges: number;
  errors: string[];
}

// --- Form schema ---
const configSchema = z.object({
  email: z.string().email('Неверный email'),
  password: z.string().min(1, 'Пароль обязателен'),
  syncIntervalMinutes: z.number().min(15).max(1440),
  enabled: z.boolean(),
});

type ConfigFormData = z.infer<typeof configSchema>;

// Update schema (password optional)
const configUpdateSchema = z.object({
  email: z.string().email('Неверный email'),
  password: z.string().optional(),
  syncIntervalMinutes: z.number().min(15).max(1440),
  enabled: z.boolean(),
});

type ConfigUpdateFormData = z.infer<typeof configUpdateSchema>;

// --- Helpers ---
const getISOWeek = (date: Date): number => {
  // Convert to German timezone (Europe/Berlin) to match CraftOS
  const berlinStr = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const [y, m, day] = berlinStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

const getWeekFromDate = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  return getISOWeek(new Date(dateStr));
};

const getWeekDateRange = (week: number, year?: number): string => {
  const y = year || new Date().getFullYear();
  const jan1 = new Date(Date.UTC(y, 0, 1));
  const dayOfWeek = jan1.getUTCDay() || 7;
  const firstMonday = new Date(jan1);
  firstMonday.setUTCDate(jan1.getUTCDate() + (dayOfWeek <= 4 ? 1 - dayOfWeek : 8 - dayOfWeek));
  const start = new Date(firstMonday);
  start.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt(start)} – ${fmt(end)}`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return 'никогда';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
};

const statusColors: Record<string, string> = {
  'Scheduled': 'bg-green-50 text-green-700 border border-green-200',
  'In Progress': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Cannot Complete': 'bg-red-50 text-red-700 border border-red-200',
  'Cancelled': 'bg-gray-50 text-gray-500 border border-gray-200',
};

const statusLabels: Record<string, string> = {
  'Scheduled': 'Запланирован',
  'In Progress': 'В работе',
  'Completed': 'Завершён',
  'Cannot Complete': 'Не завершён',
  'Cancelled': 'Отменён',
};

// --- Component ---
export default function CraftosSync() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [configCollapsed, setConfigCollapsed] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<CraftosAppointment | null>(null);

  // Filters
  const [filterTab, setFilterTab] = useState<'all' | 'unlinked' | 'linked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(50);

  // Sync week range: absolute KW numbers (1-53)
  const currentWeek = getISOWeek(new Date());
  const [syncWeekFrom, setSyncWeekFrom] = useState(Math.max(1, currentWeek - 4));
  const [syncWeekTo, setSyncWeekTo] = useState(Math.min(53, currentWeek + 8));

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) setSelectedFirmId(firmId);
  }, []);

  // Listen for firm changes
  useEffect(() => {
    const handler = () => {
      const firmId = localStorage.getItem('selectedFirmId');
      if (firmId && firmId !== selectedFirmId) setSelectedFirmId(firmId);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [selectedFirmId]);

  // --- Queries ---
  const { data: config, isLoading: configLoading } = useQuery<CraftosConfig | null>({
    queryKey: ['/api/craftos/config', selectedFirmId],
    queryFn: async () => {
      const res = await apiRequest(`/api/craftos/config/${selectedFirmId}`, 'GET');
      return res.json();
    },
    enabled: !!selectedFirmId,
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<CraftosAppointment[]>({
    queryKey: ['/api/craftos/appointments', selectedFirmId],
    queryFn: async () => {
      const res = await apiRequest(`/api/craftos/appointments/${selectedFirmId}`, 'GET');
      return res.json();
    },
    enabled: !!selectedFirmId,
  });

  // --- Filtered & paginated data ---
  // Available teams from appointments
  const availableTeams = useMemo(() => {
    const teams = new Map<string, number>();
    for (const a of appointments) {
      const t = a.teamName || '';
      if (t) teams.set(t, (teams.get(t) || 0) + 1);
    }
    return Array.from(teams.entries())
      .sort((a, b) => {
        const numA = parseInt(a[0].replace(/\D/g, '')) || 0;
        const numB = parseInt(b[0].replace(/\D/g, '')) || 0;
        return numA - numB;
      })
      .map(([name, count]) => ({ name, count }));
  }, [appointments]);

  // Available weeks from appointments
  const availableWeeks = useMemo(() => {
    const weeks = new Map<number, number>();
    for (const a of appointments) {
      const w = getWeekFromDate(a.appointmentDate as string | null);
      if (w !== null) {
        weeks.set(w, (weeks.get(w) || 0) + 1);
      }
    }
    return Array.from(weeks.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([week, count]) => ({ week, count }));
  }, [appointments]);

  const filteredAppointments = useMemo(() => {
    let filtered = appointments;

    if (filterTab === 'unlinked') {
      filtered = filtered.filter(a => !a.projectId);
    } else if (filterTab === 'linked') {
      filtered = filtered.filter(a => !!a.projectId);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(a => a.status === statusFilter);
    }

    if (weekFilter !== 'all') {
      const wf = parseInt(weekFilter);
      filtered = filtered.filter(a => getWeekFromDate(a.appointmentDate as string | null) === wf);
    }

    if (teamFilter !== 'all') {
      filtered = filtered.filter(a => a.teamName === teamFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        (a.externalCaseId || '').toLowerCase().includes(q) ||
        (a.customerName || '').toLowerCase().includes(q) ||
        (a.firstName || '').toLowerCase().includes(q) ||
        (a.lastName || '').toLowerCase().includes(q) ||
        (a.address || '').toLowerCase().includes(q) ||
        (a.city || '').toLowerCase().includes(q) ||
        (a.teamName || '').toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [appointments, filterTab, statusFilter, weekFilter, teamFilter, searchQuery]);

  const visibleAppointments = filteredAppointments.slice(0, visibleCount);

  // Unique statuses for filter
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set(appointments.map(a => a.status).filter(Boolean));
    return Array.from(statuses) as string[];
  }, [appointments]);

  // Stats
  const stats = useMemo(() => {
    const total = appointments.length;
    const unlinked = appointments.filter(a => !a.projectId).length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dateChanges = appointments.filter(a =>
      a.dateChangedAt && new Date(a.dateChangedAt).getTime() > sevenDaysAgo
    ).length;
    return { total, unlinked, dateChanges };
  }, [appointments]);

  // --- Form ---
  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configSchema),
    defaultValues: { email: '', password: '', syncIntervalMinutes: 60, enabled: true },
  });

  const updateForm = useForm<ConfigUpdateFormData>({
    resolver: zodResolver(configUpdateSchema),
    defaultValues: { email: '', password: '', syncIntervalMinutes: 60, enabled: true },
  });

  // --- Mutations ---
  const saveConfigMutation = useMutation({
    mutationFn: async (data: ConfigFormData | ConfigUpdateFormData) => {
      const body: any = {
        firmId: parseInt(selectedFirmId),
        email: data.email,
        enabled: data.enabled,
        syncIntervalMinutes: data.syncIntervalMinutes,
      };
      if (data.password) body.password = data.password;
      const res = await apiRequest('/api/craftos/config', 'POST', body);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Успех', description: data.message || 'Конфигурация сохранена' });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/config'] });
      setConfigOpen(false);
      setIsEditing(false);
      form.reset();
      updateForm.reset();
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка', description: err.message || 'Ошибка сохранения', variant: 'destructive' });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/craftos/config/${selectedFirmId}`, 'DELETE');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Удалено', description: 'Конфигурация CraftOS удалена' });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/config'] });
      setDeleteConfirmOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    },
  });

  const testAuthMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const res = await apiRequest('/api/craftos/test-auth', 'POST', data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: 'Успех', description: data.message });
      } else {
        toast({ title: 'Ошибка', description: data.message, variant: 'destructive' });
      }
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка', description: err.message || 'Ошибка тестирования', variant: 'destructive' });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (params?: { weekFrom?: number; weekTo?: number }) => {
      const res = await apiRequest(`/api/craftos/sync/${selectedFirmId}`, 'POST', {
        weekFrom: params?.weekFrom,
        weekTo: params?.weekTo,
      });
      return res.json() as Promise<SyncResult & { weeksFetched?: number[] }>;
    },
    onSuccess: (data) => {
      const weeksInfo = data.weeksFetched ? ` (нед. ${data.weeksFetched[0]}–${data.weeksFetched[data.weeksFetched.length - 1]})` : '';
      toast({
        title: 'Синхронизация завершена',
        description: `Новых: ${data.newCount}, обновлено: ${data.updatedCount}, изменения дат: ${data.dateChanges}${weeksInfo}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/config'] });
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка синхронизации', description: err.message, variant: 'destructive' });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (appointmentId: number) => {
      const res = await apiRequest(`/api/craftos/create-project/${appointmentId}`, 'POST', {
        firmId: parseInt(selectedFirmId),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Проект создан', description: `ID проекта: ${data.projectId}` });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/appointments'] });
      setDetailAppointment(null);
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка', description: err.message || 'Ошибка создания проекта', variant: 'destructive' });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/craftos/bulk-create/${selectedFirmId}`, 'POST');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Массовое создание', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/craftos/appointments'] });
    },
    onError: (err: any) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    },
  });

  // --- Handlers ---
  const openEditConfig = () => {
    if (config) {
      updateForm.reset({
        email: config.email,
        password: '',
        syncIntervalMinutes: config.syncIntervalMinutes,
        enabled: config.enabled,
      });
      setIsEditing(true);
      setConfigOpen(true);
    }
  };

  const openNewConfig = () => {
    form.reset({ email: '', password: '', syncIntervalMinutes: 60, enabled: true });
    setIsEditing(false);
    setConfigOpen(true);
  };

  const handleTestAuth = () => {
    const formData = isEditing ? updateForm.getValues() : form.getValues();
    if (!formData.email || (!formData.password && !isEditing)) {
      toast({ title: 'Ошибка', description: 'Введите email и пароль для теста', variant: 'destructive' });
      return;
    }
    if (!formData.password && isEditing && config) {
      toast({ title: 'Внимание', description: 'Введите пароль для тестирования подключения', variant: 'destructive' });
      return;
    }
    testAuthMutation.mutate({ email: formData.email, password: formData.password! });
  };

  // --- Render ---
  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">CraftOS Sync</h1>
          <p className="text-gray-600">Пожалуйста, выберите фирму в заголовке.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">CraftOS Sync</h1>
            <p className="text-gray-600 mt-1">Синхронизация назначений из CraftOS Digital Desks</p>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && stats.unlinked > 0 && (
              <Button
                variant="outline"
                onClick={() => bulkCreateMutation.mutate()}
                disabled={bulkCreateMutation.isPending}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Создать все ({stats.unlinked})
              </Button>
            )}
            <Button
              onClick={() => syncMutation.mutate({ weekFrom: syncWeekFrom, weekTo: syncWeekTo })}
              disabled={syncMutation.isPending || !config?.enabled}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Синхронизация...' : 'Синхронизировать'}
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Всего назначений</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Без проекта</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.unlinked}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Изменения дат (7д)</p>
                  <p className="text-2xl font-bold text-red-600">{stats.dateChanges}</p>
                </div>
                <CalendarClock className="w-8 h-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Последняя синхр.</p>
                  <p className="text-lg font-semibold">{formatRelativeTime(config?.lastSyncAt || null)}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync week range */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Диапазон парсинга:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">с</span>
                <Select value={String(syncWeekFrom)} onValueChange={(v) => setSyncWeekFrom(parseInt(v))}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                      <SelectItem key={w} value={String(w)}>
                        KW {w} ({getWeekDateRange(w)}){w === currentWeek ? ' •тек.' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-gray-500">по</span>
                <Select value={String(syncWeekTo)} onValueChange={(v) => setSyncWeekTo(parseInt(v))}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 53 }, (_, i) => i + 1).map(w => (
                      <SelectItem key={w} value={String(w)}>
                        KW {w} ({getWeekDateRange(w)}){w === currentWeek ? ' •тек.' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setSyncWeekFrom(1); setSyncWeekTo(53); }}
                >
                  Весь год
                </button>
                <span className="text-gray-300">|</span>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setSyncWeekFrom(Math.max(1, currentWeek - 4)); setSyncWeekTo(Math.min(53, currentWeek + 8)); }}
                >
                  По умолч.
                </button>
                <span className="text-gray-300">|</span>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => { setSyncWeekFrom(1); setSyncWeekTo(currentWeek); }}
                >
                  Все прошлые
                </button>
              </div>
              <span className="text-xs text-gray-400 ml-auto">
                {syncWeekTo - syncWeekFrom + 1} нед. • KW {syncWeekFrom} — KW {syncWeekTo}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Config card - admin only */}
        {isAdmin && (<Card>
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setConfigCollapsed(!configCollapsed)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="w-5 h-5" />
                Конфигурация CraftOS
                {config ? (
                  <Badge variant={config.enabled ? 'default' : 'secondary'} className="ml-2">
                    {config.enabled ? 'Активно' : 'Отключено'}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-2">Не настроено</Badge>
                )}
              </CardTitle>
              {configCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </div>
          </CardHeader>
          {!configCollapsed && (
            <CardContent>
              {configLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : config ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium">{config.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Интервал:</span>
                      <span className="ml-2 font-medium">{config.syncIntervalMinutes} мин</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Статус синхр.:</span>
                      <span className="ml-2">
                        {config.lastSyncStatus === 'success' && (
                          <Badge variant="default" className="bg-green-100 text-green-700">Успешно</Badge>
                        )}
                        {config.lastSyncStatus === 'error' && (
                          <Badge variant="destructive">Ошибка</Badge>
                        )}
                        {config.lastSyncStatus === 'partial' && (
                          <Badge variant="default" className="bg-yellow-100 text-yellow-700">Частично</Badge>
                        )}
                        {!config.lastSyncStatus && (
                          <Badge variant="outline">Нет данных</Badge>
                        )}
                      </span>
                    </div>
                  </div>
                  {config.lastSyncError && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
                      {config.lastSyncError}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={openEditConfig}>
                      <Settings className="w-4 h-4 mr-1" />
                      Редактировать
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Удалить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <WifiOff className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-3">CraftOS не настроен для этой фирмы</p>
                  <Button onClick={openNewConfig}>
                    <Plus className="w-4 h-4 mr-2" />
                    Настроить CraftOS
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>)}

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {([
              ['all', 'Все'],
              ['unlinked', 'Без проекта'],
              ['linked', 'С проектом'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setFilterTab(key); setVisibleCount(50); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filterTab === key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                {key === 'unlinked' && stats.unlinked > 0 && (
                  <span className="ml-1 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">
                    {stats.unlinked}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск по ID, клиенту, адресу..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(50); }}
              className="pl-9"
            />
          </div>

          {availableWeeks.length > 0 && (
            <Select value={weekFilter} onValueChange={(v) => { setWeekFilter(v); setVisibleCount(50); }}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Неделя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все недели</SelectItem>
                {availableWeeks.map(({ week, count }) => (
                  <SelectItem key={week} value={String(week)}>
                    KW {week} ({getWeekDateRange(week)}) — {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {availableTeams.length > 0 && (
            <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setVisibleCount(50); }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Бригада" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все бригады</SelectItem>
                {availableTeams.map(({ name, count }) => (
                  <SelectItem key={name} value={name}>
                    {name} — {count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {uniqueStatuses.length > 0 && (
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setVisibleCount(50); }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {uniqueStatuses.map(s => (
                  <SelectItem key={s} value={s}>{statusLabels[s] || s} — {appointments.filter(a => a.status === s).length}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <span className="text-sm text-gray-500">
            {filteredAppointments.length} из {appointments.length}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {appointmentsLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100 mx-6">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {appointments.length === 0 ? 'Нет назначений' : 'Нет результатов'}
                </h3>
                <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                  {appointments.length === 0
                    ? 'Настройте CraftOS и нажмите "Синхронизировать" для загрузки назначений'
                    : 'Попробуйте изменить фильтры для отображения результатов'
                  }
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Case ID</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Адрес</TableHead>
                      <TableHead className="w-16">KW</TableHead>
                      <TableHead className="w-28">Дата</TableHead>
                      <TableHead>Бригада</TableHead>
                      <TableHead className="w-28">Статус</TableHead>
                      <TableHead className="w-24">Тип</TableHead>
                      <TableHead className="w-32">Проект</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleAppointments.map((apt) => {
                      const hasDateChange = !!apt.previousAppointmentDate;
                      const hasStatusChange = !!apt.previousStatus;

                      return (
                        <TableRow
                          key={apt.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setDetailAppointment(apt)}
                        >
                          <TableCell className="font-mono text-xs">{apt.externalCaseId}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">
                              {apt.lastName}{apt.firstName ? `, ${apt.firstName}` : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-600 max-w-xs truncate">
                              {[apt.address, apt.zipCode, apt.city].filter(Boolean).join(', ')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-medium text-gray-500">
                              {getWeekFromDate(apt.appointmentDate as string | null) ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1">
                                <span className="text-sm">{formatDate(apt.appointmentDate as any)}</span>
                                {hasDateChange && (
                                  <span title="Дата перенесена">
                                    <CalendarClock className="w-3.5 h-3.5 text-red-500" />
                                  </span>
                                )}
                              </div>
                              {hasDateChange && (
                                <span className="text-xs text-red-500 line-through">
                                  {formatDate(apt.previousAppointmentDate as any)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{apt.teamName || '—'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${statusColors[apt.status || ''] || 'bg-gray-100 text-gray-600'}`}
                            >
                              {statusLabels[apt.status || ''] || apt.status || '—'}
                              {hasStatusChange && ' *'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-gray-500">{apt.workOrderType || '—'}</span>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {apt.projectId ? (
                              <a
                                href={`/projects/${apt.projectId}`}
                                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                              >
                                #{apt.projectId}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 text-xs"
                                onClick={() => createProjectMutation.mutate(apt.id)}
                                disabled={createProjectMutation.isPending}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Создать
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {visibleCount < filteredAppointments.length && (
                <div className="p-4 text-center border-t">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount(prev => prev + 50)}
                  >
                    Показать ещё ({filteredAppointments.length - visibleCount} осталось)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Config Dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Редактировать конфигурацию' : 'Настройка CraftOS'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={isEditing
              ? updateForm.handleSubmit((data) => saveConfigMutation.mutate(data))
              : form.handleSubmit((data) => saveConfigMutation.mutate(data))
            }
            className="space-y-4"
          >
            <div>
              <Label htmlFor="cfg-email">Email CraftOS</Label>
              <Input
                id="cfg-email"
                type="email"
                {...(isEditing ? updateForm.register('email') : form.register('email'))}
                placeholder="user@enpal.de"
              />
              {(isEditing ? updateForm.formState.errors.email : form.formState.errors.email) && (
                <p className="text-red-500 text-sm mt-1">
                  {(isEditing ? updateForm.formState.errors.email : form.formState.errors.email)?.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="cfg-password">
                Пароль {isEditing && <span className="text-gray-400 text-xs">(оставьте пустым, чтобы не менять)</span>}
              </Label>
              <Input
                id="cfg-password"
                type="password"
                {...(isEditing ? updateForm.register('password') : form.register('password'))}
                placeholder={isEditing ? '••••••••' : 'Пароль'}
              />
              {!isEditing && form.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="cfg-interval">Интервал синхронизации (мин)</Label>
              <Input
                id="cfg-interval"
                type="number"
                min={15}
                max={1440}
                {...(isEditing
                  ? updateForm.register('syncIntervalMinutes', { valueAsNumber: true })
                  : form.register('syncIntervalMinutes', { valueAsNumber: true })
                )}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cfg-enabled">Автосинхронизация</Label>
              <Switch
                id="cfg-enabled"
                checked={isEditing ? updateForm.watch('enabled') : form.watch('enabled')}
                onCheckedChange={(v) => isEditing ? updateForm.setValue('enabled', v) : form.setValue('enabled', v)}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={saveConfigMutation.isPending}>
                {saveConfigMutation.isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestAuth}
                disabled={testAuthMutation.isPending}
              >
                <Wifi className="w-4 h-4 mr-1" />
                {testAuthMutation.isPending ? 'Тест...' : 'Тест'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailAppointment} onOpenChange={(open) => !open && setDetailAppointment(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>Назначение {detailAppointment?.externalCaseId}</span>
              {detailAppointment?.projectId && (
                <Badge variant="default" className="bg-green-100 text-green-700">Привязано</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><User className="w-3.5 h-3.5" /> Клиент</span>
                  <p className="font-medium">{detailAppointment.lastName}{detailAppointment.firstName ? `, ${detailAppointment.firstName}` : ''}</p>
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Телефон</span>
                  <p className="font-medium">{detailAppointment.phone || '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Адрес</span>
                  <p className="font-medium">
                    {[detailAppointment.address, detailAppointment.zipCode, detailAppointment.city].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Дата</span>
                  <p className="font-medium">{formatDateTime(detailAppointment.appointmentDate as any)}</p>
                  {detailAppointment.previousAppointmentDate && (
                    <p className="text-xs text-red-500 mt-1">
                      Была: {formatDateTime(detailAppointment.previousAppointmentDate as any)}
                      {detailAppointment.dateChangedAt && (
                        <span className="text-gray-400 ml-1">
                          (изм. {formatDate(detailAppointment.dateChangedAt as any)})
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Бригада</span>
                  <p className="font-medium">{detailAppointment.teamName || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Статус</span>
                  <div className="mt-0.5">
                    <Badge className={statusColors[detailAppointment.status || ''] || 'bg-gray-100 text-gray-600'}>
                      {statusLabels[detailAppointment.status || ''] || detailAppointment.status || '—'}
                    </Badge>
                    {detailAppointment.previousStatus && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Был: {detailAppointment.previousStatus}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Тип</span>
                  <p className="font-medium">{detailAppointment.workOrderType || '—'}</p>
                  {detailAppointment.appointmentType && (
                    <p className="text-xs text-gray-400">{detailAppointment.appointmentType}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                {detailAppointment.projectId ? (
                  <Button asChild className="flex-1">
                    <a href={`/projects/${detailAppointment.projectId}`}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Открыть проект #{detailAppointment.projectId}
                    </a>
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => createProjectMutation.mutate(detailAppointment.id)}
                    disabled={createProjectMutation.isPending}
                  >
                    <FolderPlus className="w-4 h-4 mr-2" />
                    {createProjectMutation.isPending ? 'Создание...' : 'Создать проект'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete config confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить конфигурацию CraftOS?</AlertDialogTitle>
            <AlertDialogDescription>
              Автосинхронизация будет остановлена. Существующие назначения сохранятся.
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfigMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteConfigMutation.isPending}
            >
              {deleteConfigMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
