import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import type { Invoice, Project } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const { formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

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
      const response = await apiRequest('/api/projects', 'GET');
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

  const getStatusBadge = (isPaid: boolean, dueDate: string) => {
    const isOverdue = new Date(dueDate) < new Date() && !isPaid;
    
    if (isPaid) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Оплачен
        </Badge>
      );
    }
    
    if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Просрочен
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 mr-1" />
        В ожидании
      </Badge>
    );
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'paid' && !invoice.isPaid) return false;
      if (filters.status === 'unpaid' && invoice.isPaid) return false;
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
            <h1 className="text-2xl font-semibold text-gray-900">Счета</h1>
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
        </div>

        {/* Invoices Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-3"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2 w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvoices.map((invoice: any) => {
              const project = getProject(invoice.projectId);
              const daysUntilDue = getDaysUntilDue(invoice.dueDate);
              
              return (
                <Card key={invoice.id} className="hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-600" />
                        #{invoice.invoiceNumber}
                      </CardTitle>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(invoice.isPaid, invoice.dueDate)}
                        <span className="text-lg font-bold text-gray-900">
                          {formatCurrency(invoice.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">PROJ-{project?.id}</span>
                      <span className="text-gray-400">•</span>
                      <span className="truncate">{project?.notes || 'Нет описания'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>Создан: {formatDate(invoice.invoiceDate)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span>Срок: {formatDate(invoice.dueDate)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className={`font-medium ${
                        daysUntilDue < 0 ? 'text-red-600' : 
                        daysUntilDue <= 7 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {invoice.isPaid ? 'Оплачен' : 
                         daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} дней просрочки` :
                         daysUntilDue === 0 ? 'Срок сегодня' :
                         `${daysUntilDue} дней до срока`}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {!invoice.isPaid && (
                        <Button
                          size="sm" 
                          onClick={() => markPaidMutation.mutate({ invoiceNumber: invoice.invoiceNumber })}
                          disabled={markPaidMutation.isPending}
                          className="flex-1 min-w-0"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Отметить как оплаченный</span>
                          <span className="sm:hidden">Оплачен</span>
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
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
