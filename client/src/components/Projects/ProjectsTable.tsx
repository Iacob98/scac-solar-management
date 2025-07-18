import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/useI18n';
import type { Project, Client, Crew, Service } from '@shared/schema';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Eye, FileText, Calendar, User, Users, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects', firmId],
    enabled: !!firmId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients', firmId],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ['/api/crews', firmId],
    enabled: !!firmId,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['/api/services', selectedProject?.id],
    enabled: !!selectedProject?.id,
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest('PUT', `/api/projects/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Erfolg',
        description: 'Projektstatus wurde aktualisiert',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest('POST', '/api/invoices/create', { projectId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Erfolg',
        description: 'Rechnung wurde erfolgreich erstellt',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      in_progress: { label: 'In Bearbeitung', variant: 'default' as const },
      done: { label: 'Abgeschlossen', variant: 'secondary' as const },
      invoiced: { label: 'Fakturiert', variant: 'outline' as const },
      paid: { label: 'Bezahlt', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.in_progress;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getClientName = (clientId: number) => {
    const client = clients.find((c) => c.id === clientId);
    return client?.name || 'Unbekannt';
  };

  const getCrewName = (crewId: number | null) => {
    if (!crewId) return 'Nicht zugewiesen';
    const crew = crews.find((c) => c.id === crewId);
    return crew?.name || 'Nicht zugewiesen';
  };

  const handleViewDetails = (project: Project) => {
    setSelectedProject(project);
    setIsDetailOpen(true);
  };

  const handleStatusChange = (projectId: number, newStatus: string) => {
    updateProjectMutation.mutate({ id: projectId, status: newStatus });
  };

  const handleCreateInvoice = (projectId: number) => {
    createInvoiceMutation.mutate(projectId);
  };

  const calculateProjectTotal = () => {
    if (!services.length) return 0;
    return services.reduce((total: number, service) => {
      return total + (parseFloat(service.price) * parseFloat(service.quantity));
    }, 0);
  };

  const filteredProjects = projects.filter((project) => {
    if (filters.clientId && filters.clientId !== 'all' && project.clientId.toString() !== filters.clientId) return false;
    if (filters.status && filters.status !== 'all' && project.status !== filters.status) return false;
    if (filters.crewId && filters.crewId !== 'all' && project.crewId?.toString() !== filters.crewId) return false;
    if (filters.startDate && project.startDate && project.startDate < filters.startDate) return false;
    if (filters.endDate && project.endDate && project.endDate > filters.endDate) return false;
    return true;
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Projekte ({filteredProjects.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Nr.</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Crew</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project: any) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-mono">
                      {project.teamNumber || `PROJ-${project.id}`}
                    </TableCell>
                    <TableCell>{getClientName(project.clientId)}</TableCell>
                    <TableCell>{getCrewName(project.crewId)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Start: {project.startDate ? new Date(project.startDate).toLocaleDateString('de-DE') : 'TBD'}</div>
                        <div>Ende: {project.endDate ? new Date(project.endDate).toLocaleDateString('de-DE') : 'TBD'}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(project.status)}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(project)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {project.status === 'done' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCreateInvoice(project.id)}
                            disabled={createInvoiceMutation.isPending}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const statusMap: Record<string, string> = {
                              'in_progress': 'done',
                              'done': 'invoiced',
                              'invoiced': 'paid',
                            };
                            const nextStatus = statusMap[project.status];
                            if (nextStatus) {
                              handleStatusChange(project.id, nextStatus);
                            }
                          }}
                          disabled={project.status === 'paid' || updateProjectMutation.isPending}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredProjects.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Keine Projekte gefunden. Erstellen Sie ein neues Projekt, um zu beginnen.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Projekt Details - {selectedProject?.teamNumber || `PROJ-${selectedProject?.id}`}
            </DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>Kunde</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>Name:</strong> {getClientName(selectedProject.clientId)}</p>
                      <p><strong>Status:</strong> {getStatusBadge(selectedProject.status)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>Crew</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p><strong>Team:</strong> {getCrewName(selectedProject.crewId)}</p>
                      <p><strong>Zeitraum:</strong></p>
                      <div className="text-sm ml-4">
                        <p>Start: {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('de-DE') : 'TBD'}</p>
                        <p>Ende: {selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString('de-DE') : 'TBD'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Leistungen</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead>Preis</TableHead>
                        <TableHead>Gesamt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>{service.description}</TableCell>
                          <TableCell>{service.quantity}</TableCell>
                          <TableCell>{parseFloat(service.price).toFixed(2)} €</TableCell>
                          <TableCell>
                            {(parseFloat(service.price) * parseFloat(service.quantity)).toFixed(2)} €
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-right">
                    <p className="text-lg font-semibold">
                      Gesamtsumme: {calculateProjectTotal().toFixed(2)} €
                    </p>
                  </div>
                </CardContent>
              </Card>

              {selectedProject.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notizen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700">{selectedProject.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}