import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Edit, 
  Folder, 
  FileText, 
  DollarSign
} from 'lucide-react';

interface ProjectsTableProps {
  firmId: string;
  filters: {
    clientId: string;
    status: string;
    crewId: string;
    startDate: string;
    endDate: string;
  };
}

export function ProjectsTable({ firmId, filters }: ProjectsTableProps) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['/api/projects', { firmId, ...filters }],
    enabled: !!firmId,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', { firmId }],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', { firmId }],
    enabled: !!firmId,
  });

  const generateInvoiceMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest('POST', '/api/invoices/create', { projectId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Rechnung erfolgreich erstellt',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceNumber }: { invoiceNumber: string }) => {
      const response = await apiRequest('PATCH', `/api/invoices/${invoiceNumber}/mark-paid?firmId=${firmId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Rechnung als bezahlt markiert',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'in_progress': { label: t('inProgress'), variant: 'default' as const },
      'done': { label: t('done'), variant: 'secondary' as const },
      'invoiced': { label: t('invoiced'), variant: 'outline' as const },
      'paid': { label: t('paid'), variant: 'destructive' as const },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap];
    return (
      <Badge variant={statusInfo?.variant || 'default'}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c: any) => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getCrewName = (crewId: number) => {
    const crew = crews.find((c: any) => c.id === crewId);
    return crew ? `${crew.name} - ${crew.leaderName}` : 'No crew assigned';
  };

  const canGenerateInvoice = (project: any) => {
    return project.status === 'done' && !project.invoiceNumber;
  };

  const canMarkPaid = (project: any) => {
    return project.status === 'invoiced' && project.invoiceNumber;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projectId')}</TableHead>
              <TableHead>{t('client')}</TableHead>
              <TableHead>{t('startDate')}</TableHead>
              <TableHead>{t('endDate')}</TableHead>
              <TableHead>{t('crew')}</TableHead>
              <TableHead>{t('amount')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('invoice')}</TableHead>
              <TableHead>{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project: any) => (
              <TableRow key={project.id}>
                <TableCell>
                  <span className="font-medium text-primary">
                    PROJ-{project.id}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{getClientName(project.clientId)}</p>
                    <p className="text-sm text-gray-500">
                      {clients.find((c: any) => c.id === project.clientId)?.address}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {project.startDate ? formatDate(project.startDate) : '-'}
                </TableCell>
                <TableCell>
                  {project.endDate ? formatDate(project.endDate) : '-'}
                </TableCell>
                <TableCell>
                  {project.crewId ? getCrewName(project.crewId) : 'No crew assigned'}
                </TableCell>
                <TableCell>
                  {formatCurrency(project.totalAmount || 0)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(project.status)}
                </TableCell>
                <TableCell>
                  {project.invoiceNumber ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{project.invoiceNumber}</span>
                      {project.invoiceUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(project.invoiceUrl, '_blank')}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    {canGenerateInvoice(project) && (
                      <Button
                        size="sm"
                        onClick={() => generateInvoiceMutation.mutate(project.id)}
                        disabled={generateInvoiceMutation.isPending}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        {t('generateInvoice')}
                      </Button>
                    )}
                    {canMarkPaid(project) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markPaidMutation.mutate({ invoiceNumber: project.invoiceNumber })}
                        disabled={markPaidMutation.isPending}
                      >
                        {t('markAsPaid')}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Folder className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
