import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Invoice, Project } from '@shared/schema';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Receipt, 
  FileText, 
  Calendar, 
  Euro, 
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function Invoices() {
  const { t, formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
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

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices', { firmId: selectedFirmId, ...filters }],
    enabled: !!selectedFirmId,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', { firmId: selectedFirmId }],
    enabled: !!selectedFirmId,
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceNumber }: { invoiceNumber: string }) => {
      const response = await apiRequest('PATCH', `/api/invoices/${invoiceNumber}/mark-paid?firmId=${selectedFirmId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Rechnung als bezahlt markiert',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
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
          Bezahlt
        </Badge>
      );
    }
    
    if (isOverdue) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="w-3 h-3 mr-1" />
          Überfällig
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary">
        <Clock className="w-3 h-3 mr-1" />
        Ausstehend
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
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {t('invoices')}
          </h1>
          <p className="text-gray-600">
            Bitte wählen Sie eine Firma aus dem Header aus, um Rechnungen zu verwalten.
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
            <h1 className="text-2xl font-semibold text-gray-900">{t('invoices')}</h1>
            <p className="text-gray-600 mt-1">Verwalten Sie Ihre Rechnungen und Zahlungen</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gesamtsumme</p>
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
                <p className="text-sm font-medium text-gray-600">Unbezahlt</p>
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
                <p className="text-sm font-medium text-gray-600">Rechnungen</p>
                <p className="text-2xl font-semibold text-gray-900">{filteredInvoices.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Receipt className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">{t('status')}</Label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Alle Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="paid">Bezahlt</SelectItem>
                  <SelectItem value="unpaid">Unbezahlt</SelectItem>
                  <SelectItem value="overdue">Überfällig</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">Von Datum</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700 mb-1">Bis Datum</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rechnungsnummer</TableHead>
                  <TableHead>Projekt</TableHead>
                  <TableHead>Rechnungsdatum</TableHead>
                  <TableHead>Fälligkeitsdatum</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>Tage bis Fälligkeit</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice: any) => {
                  const project = getProject(invoice.projectId);
                  const daysUntilDue = getDaysUntilDue(invoice.dueDate);
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Receipt className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-primary">{invoice.invoiceNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">PROJ-{project?.id}</p>
                          <p className="text-sm text-gray-500">{project?.notes || 'Keine Beschreibung'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(invoice.invoiceDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(invoice.dueDate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.isPaid, invoice.dueDate)}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          daysUntilDue < 0 ? 'text-red-600' : 
                          daysUntilDue <= 7 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {invoice.isPaid ? 'Bezahlt' : 
                           daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} Tage überfällig` :
                           daysUntilDue === 0 ? 'Heute fällig' :
                           `${daysUntilDue} Tage`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {!invoice.isPaid && (
                            <Button
                              size="sm"
                              onClick={() => markPaidMutation.mutate({ invoiceNumber: invoice.invoiceNumber })}
                              disabled={markPaidMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Als bezahlt markieren
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (project?.invoiceUrl) {
                                window.open(project.invoiceUrl, '_blank');
                              }
                            }}
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
