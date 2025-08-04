import { useState, useEffect } from 'react';
import { useTranslation } from '@shared/i18n';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import type { Invoice, Project } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Receipt, 
  FileText, 
  Calendar, 
  Euro, 
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  RefreshCcw,
  Check,
  Eye,
  RotateCw
} from 'lucide-react';

export default function Invoices() {
  const { t } = useTranslation();
  const { formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [hidePaid, setHidePaid] = useState(false);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: invoices = [], isLoading, error, refetch } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices', selectedFirmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/invoices/${selectedFirmId}?_t=${Date.now()}`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirmId && user?.role === 'admin',
    retry: false,
    staleTime: 0,
  });

  // Show access denied message for non-admin users
  if (user && user.role !== 'admin') {
    return (
      <MainLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                Доступ запрещен
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                Только администраторы могут просматривать счета.
              </p>
              <p className="text-sm text-gray-500">
                Обратитесь к администратору для получения доступа.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', selectedFirmId],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?firmId=${selectedFirmId}`, 'GET');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceNumber }: { invoiceNumber: string }) => {
      const response = await apiRequest('/api/invoice/mark-paid', 'PATCH', { invoiceNumber });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Успешно',
        description: 'Счет отмечен как оплаченный',
      });
      // Принудительно обновляем кэш всех связанных данных
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Дополнительно рефетчим текущие данные
      queryClient.refetchQueries({ queryKey: ['/api/invoices', selectedFirmId] });
    },
    onError: (error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const syncPaymentMutation = useMutation({
    mutationFn: async ({ invoiceNumber }: { invoiceNumber: string }) => {
      const response = await apiRequest('/api/invoices/sync-payment-status', 'POST', { invoiceNumber });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.updated) {
        toast({
          title: 'Синхронизация завершена',
          description: `Статус счета обновлен: ${data.isPaid ? 'оплачен' : 'не оплачен'}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.refetchQueries({ queryKey: ['/api/invoices', selectedFirmId] });
      } else {
        toast({
          title: 'Синхронизация завершена',
          description: 'Статус счета не изменился',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Ошибка синхронизации',
        description: 'Не удалось проверить статус счета в Invoice Ninja',
        variant: 'destructive',
      });
    },
  });

  const syncAllPaymentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/invoices/sync-all-payment-status/${selectedFirmId}`, 'POST');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Синхронизация завершена',
        description: `Проверено счетов: ${data.totalInvoices}, обновлено: ${data.updatedCount}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.refetchQueries({ queryKey: ['/api/invoices', selectedFirmId] });
      // Принудительно рефетчим все связанные запросы
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['/api/invoices'] });
      }, 500);
    },
    onError: (error) => {
      toast({
        title: 'Ошибка синхронизации',
        description: 'Не удалось синхронизировать все счета',
        variant: 'destructive',
      });
    },
  });

  const getProject = (projectId: number) => {
    return projects.find((p) => p.id === projectId);
  };

  const getStatusBadge = (invoice: any) => {
    const isOverdue = new Date(invoice.dueDate) < new Date() && !invoice.isPaid;
    const status = invoice.status || 'draft';
    
    // Приоритет для статуса "Оплачен"
    if (invoice.isPaid) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Оплачен
        </Badge>
      );
    }
    
    // Приоритет для просроченных счетов
    if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Просрочен
        </Badge>
      );
    }
    
    // Статусы из Invoice Ninja API
    switch (status) {
      case 'sent':
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            Отправлен
          </Badge>
        );
      case 'viewed':
        return (
          <Badge variant="default" className="bg-indigo-100 text-indigo-800">
            <Eye className="w-3 h-3 mr-1" />
            Просмотрен
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="default" className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Частично оплачен
          </Badge>
        );
      case 'draft':
        return (
          <Badge variant="secondary">
            <FileText className="w-3 h-3 mr-1" />
            Черновик
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            В ожидании
          </Badge>
        );
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const navigateToProject = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredInvoices = invoices.filter((invoice) => {
    // Скрытие оплаченных счетов
    if (hidePaid && invoice.isPaid) {
      return false;
    }
    
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'paid' && !invoice.isPaid) return false;
      if (filters.status === 'unpaid' && invoice.isPaid) return false;
      if (filters.status === 'sent' && invoice.status !== 'sent') return false;
      if (filters.status === 'overdue') {
        const isOverdue = new Date(invoice.dueDate) < new Date() && !invoice.isPaid;
        if (!isOverdue) return false;
      }
    }
    return true;
  });

  const totalAmount = filteredInvoices.reduce((sum: number, invoice) => 
    sum + parseFloat(invoice.totalAmount), 0
  );

  const unpaidAmount = filteredInvoices
    .filter((invoice) => !invoice.isPaid)
    .reduce((sum: number, invoice) => sum + parseFloat(invoice.totalAmount), 0);

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-4 sm:p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Счета
          </h1>
          <p className="text-gray-600">
            Пожалуйста, выберите фирму в шапке страницы для управления счетами.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('счета', 'Счета')}</h1>
            <p className="text-gray-600 mt-1">Управляйте своими счетами и платежами</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => syncAllPaymentsMutation.mutate()}
              disabled={syncAllPaymentsMutation.isPending}
              variant="outline"
              className="w-full sm:w-auto"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${syncAllPaymentsMutation.isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Синхронизировать все платежи</span>
              <span className="sm:hidden">Синхронизировать</span>
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Общая сумма</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Euro className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Неоплачено</p>
                <p className="text-2xl font-semibold text-gray-900">{formatCurrency(unpaidAmount)}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Счета</p>
                <p className="text-2xl font-semibold text-gray-900">{filteredInvoices.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 sm:p-6 border-b rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">Статус</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Все статусы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="paid">Оплачен</SelectItem>
                  <SelectItem value="sent">Отправлен</SelectItem>
                  <SelectItem value="unpaid">Неоплачен</SelectItem>
                  <SelectItem value="overdue">Просрочен</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">С даты</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">По дату</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="hide-paid"
                checked={hidePaid}
                onCheckedChange={setHidePaid}
              />
              <Label htmlFor="hide-paid" className="text-sm text-gray-600">
                Скрыть оплаченные счета
              </Label>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {isLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
                <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Receipt className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Нет счетов
                </h3>
                <p className="text-gray-600 mb-4 max-w-sm mx-auto">
                  Создайте проекты и выставите счета для их отображения здесь
                </p>
                <div className="flex items-center justify-center text-sm text-purple-600">
                  <FileText className="h-4 w-4 mr-1" />
                  Счета будут создаваться автоматически из проектов
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Счет</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead>Срок</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice: any) => {
                  const project = getProject(invoice.projectId);
                  const daysUntilDue = getDaysUntilDue(invoice.dueDate);
                  
                  return (
                    <TableRow key={invoice.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => navigateToProject(invoice.projectId)}
                            className="flex items-center space-x-2 hover:text-blue-600 transition-colors"
                            title="Перейти к проекту"
                          >
                            <Receipt className="h-5 w-5 text-blue-600" />
                            <span className="font-medium">#{invoice.invoiceNumber}</span>
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">PROJ-{project?.id}</span>
                          <span className="text-sm text-gray-500 truncate max-w-xs">
                            {project?.notes || 'Нет описания'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {formatDate(invoice.invoiceDate)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-600">
                            {formatDate(invoice.dueDate)}
                          </span>
                          <span className={`text-xs font-medium ${
                            daysUntilDue < 0 ? 'text-red-600' : 
                            daysUntilDue <= 7 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {invoice.isPaid ? 'Оплачен' : 
                             daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} дней просрочки` :
                             daysUntilDue === 0 ? 'Срок сегодня' :
                             `${daysUntilDue} дней до срока`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {!invoice.isPaid && (
                            <Button
                              size="sm" 
                              onClick={() => markPaidMutation.mutate({ invoiceNumber: invoice.invoiceNumber })}
                              disabled={markPaidMutation.isPending}
                              title="Отметить как оплаченный"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Оплачен
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncPaymentMutation.mutate({ invoiceNumber: invoice.invoiceNumber })}
                            disabled={syncPaymentMutation.isPending}
                            title="Проверить статус оплаты в Invoice Ninja"
                            className="h-9 w-9 p-0"
                          >
                            <RotateCw className={`w-4 h-4 ${syncPaymentMutation.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (project?.invoiceUrl) {
                                window.open(project.invoiceUrl, '_blank');
                              }
                            }}
                            title="Открыть PDF счета"
                            className="h-9 w-9 p-0"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
