import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useI18n } from '@/hooks/useI18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, ArrowLeft, ArrowRight, Check, User, Users, Calendar, FileText } from 'lucide-react';

const projectSchema = z.object({
  clientId: z.string().min(1, 'Kunde ist erforderlich'),
  crewId: z.string().optional(),
  startDate: z.string().min(1, 'Startdatum ist erforderlich'),
  endDate: z.string().optional(),
  teamNumber: z.string().min(1, 'Team-Nummer ist erforderlich'),
  notes: z.string().optional(),
});

const serviceSchema = z.object({
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  price: z.string().min(1, 'Preis ist erforderlich'),
  quantity: z.string().min(1, 'Menge ist erforderlich'),
  productKey: z.string().optional(),
});

interface ProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  firmId: string;
}

export function ProjectWizard({ isOpen, onClose, firmId }: ProjectWizardProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [projectData, setProjectData] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', firmId],
    enabled: !!firmId && isOpen,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', firmId],
    enabled: !!firmId && isOpen,
  });

  const projectForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      clientId: '',
      crewId: '',
      startDate: '',
      endDate: '',
      teamNumber: '',
      notes: '',
    },
  });

  const serviceForm = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      description: '',
      price: '',
      quantity: '1',
      productKey: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/projects', data);
      return response.json();
    },
    onSuccess: (project) => {
      setProjectData(project);
      setCurrentStep(2);
      toast({
        title: 'Erfolg',
        description: 'Projekt wurde erstellt',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/services', {
        ...data,
        projectId: projectData?.id,
      });
      return response.json();
    },
    onSuccess: (service) => {
      setServices(prev => [...prev, service]);
      serviceForm.reset();
      toast({
        title: 'Erfolg',
        description: 'Leistung hinzugefügt',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      await apiRequest('DELETE', `/api/services/${serviceId}`);
    },
    onSuccess: (_, serviceId) => {
      setServices(prev => prev.filter(s => s.id !== serviceId));
      toast({
        title: 'Erfolg',
        description: 'Leistung entfernt',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onProjectSubmit = (data: z.infer<typeof projectSchema>) => {
    createProjectMutation.mutate({
      ...data,
      firmId,
      clientId: parseInt(data.clientId),
      crewId: data.crewId ? parseInt(data.crewId) : null,
    });
  };

  const onServiceSubmit = (data: z.infer<typeof serviceSchema>) => {
    createServiceMutation.mutate({
      ...data,
      price: parseFloat(data.price),
      quantity: parseFloat(data.quantity),
    });
  };

  const finishWizard = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    resetWizard();
    onClose();
    toast({
      title: 'Projekt erstellt',
      description: `Projekt ${projectData?.teamNumber} wurde erfolgreich erstellt`,
    });
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setProjectData(null);
    setServices([]);
    projectForm.reset();
    serviceForm.reset();
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const calculateTotal = () => {
    return services.reduce((total, service) => {
      return total + (parseFloat(service.price) * parseFloat(service.quantity));
    }, 0);
  };

  const getClientName = (clientId: string) => {
    const client = clients.find((c: any) => c.id.toString() === clientId);
    return client?.name || 'Unbekannt';
  };

  const getCrewName = (crewId: string) => {
    const crew = crews.find((c: any) => c.id.toString() === crewId);
    return crew?.name || 'Nicht zugewiesen';
  };

  const steps = [
    { id: 1, title: 'Projekt Details', icon: FileText },
    { id: 2, title: 'Leistungen', icon: Plus },
    { id: 3, title: 'Zusammenfassung', icon: Check },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Projekt erstellen</DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-center space-x-4 mb-6">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  currentStep >= step.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                <step.icon className="w-4 h-4" />
              </div>
              <span className={`ml-2 ${currentStep >= step.id ? 'text-primary' : 'text-gray-500'}`}>
                {step.title}
              </span>
              {index < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 mx-4 text-gray-300" />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Project Details */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Projekt Grunddaten</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={projectForm.handleSubmit(onProjectSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="teamNumber">Team-Nummer</Label>
                    <Input
                      id="teamNumber"
                      {...projectForm.register('teamNumber')}
                      placeholder="SOL-2025-003"
                    />
                    {projectForm.formState.errors.teamNumber && (
                      <p className="text-red-500 text-sm mt-1">
                        {projectForm.formState.errors.teamNumber.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="clientId">Kunde</Label>
                    <Select
                      value={projectForm.watch('clientId')}
                      onValueChange={(value) => projectForm.setValue('clientId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kunde auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id.toString()}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {projectForm.formState.errors.clientId && (
                      <p className="text-red-500 text-sm mt-1">
                        {projectForm.formState.errors.clientId.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="crewId">Crew (optional)</Label>
                    <Select
                      value={projectForm.watch('crewId')}
                      onValueChange={(value) => projectForm.setValue('crewId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Crew auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Später zuweisen</SelectItem>
                        {crews.filter((c: any) => !c.archived).map((crew: any) => (
                          <SelectItem key={crew.id} value={crew.id.toString()}>
                            {crew.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="startDate">Startdatum</Label>
                    <Input
                      id="startDate"
                      type="date"
                      {...projectForm.register('startDate')}
                    />
                    {projectForm.formState.errors.startDate && (
                      <p className="text-red-500 text-sm mt-1">
                        {projectForm.formState.errors.startDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="endDate">Enddatum (optional)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      {...projectForm.register('endDate')}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notizen</Label>
                  <Textarea
                    id="notes"
                    {...projectForm.register('notes')}
                    placeholder="Besondere Anforderungen, Hinweise..."
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={createProjectMutation.isPending}>
                    {createProjectMutation.isPending ? 'Erstelle...' : 'Weiter'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Services */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span>Leistungen hinzufügen</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="description">Beschreibung</Label>
                      <Input
                        id="description"
                        {...serviceForm.register('description')}
                        placeholder="Solarmodule 400W"
                      />
                      {serviceForm.formState.errors.description && (
                        <p className="text-red-500 text-sm mt-1">
                          {serviceForm.formState.errors.description.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="quantity">Menge</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        {...serviceForm.register('quantity')}
                        placeholder="1"
                      />
                      {serviceForm.formState.errors.quantity && (
                        <p className="text-red-500 text-sm mt-1">
                          {serviceForm.formState.errors.quantity.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="price">Preis (€)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        {...serviceForm.register('price')}
                        placeholder="450.00"
                      />
                      {serviceForm.formState.errors.price && (
                        <p className="text-red-500 text-sm mt-1">
                          {serviceForm.formState.errors.price.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="productKey">Produkt-Code (optional)</Label>
                    <Input
                      id="productKey"
                      {...serviceForm.register('productKey')}
                      placeholder="SOL_MOD_400W"
                    />
                  </div>

                  <Button type="submit" disabled={createServiceMutation.isPending}>
                    <Plus className="w-4 h-4 mr-2" />
                    {createServiceMutation.isPending ? 'Hinzufügen...' : 'Leistung hinzufügen'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Hinzugefügte Leistungen</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Beschreibung</TableHead>
                        <TableHead>Menge</TableHead>
                        <TableHead>Preis</TableHead>
                        <TableHead>Gesamt</TableHead>
                        <TableHead>Aktionen</TableHead>
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
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteServiceMutation.mutate(service.id)}
                              disabled={deleteServiceMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-right">
                    <p className="text-lg font-semibold">
                      Gesamtsumme: {calculateTotal().toFixed(2)} €
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
              <Button onClick={() => setCurrentStep(3)}>
                Weiter
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Check className="w-5 h-5" />
                  <span>Projekt Zusammenfassung</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Projekt Details</h3>
                    <div className="space-y-2 text-sm">
                      <p><strong>Team-Nummer:</strong> {projectData?.teamNumber}</p>
                      <p><strong>Kunde:</strong> {getClientName(projectForm.watch('clientId'))}</p>
                      <p><strong>Crew:</strong> {projectForm.watch('crewId') ? getCrewName(projectForm.watch('crewId')) : 'Nicht zugewiesen'}</p>
                      <p><strong>Startdatum:</strong> {projectForm.watch('startDate') ? new Date(projectForm.watch('startDate')).toLocaleDateString('de-DE') : 'TBD'}</p>
                      <p><strong>Enddatum:</strong> {projectForm.watch('endDate') ? new Date(projectForm.watch('endDate')).toLocaleDateString('de-DE') : 'TBD'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Leistungen ({services.length})</h3>
                    <div className="space-y-2 text-sm">
                      {services.map((service, index) => (
                        <div key={service.id} className="flex justify-between">
                          <span>{service.description}</span>
                          <span>{(parseFloat(service.price) * parseFloat(service.quantity)).toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Gesamtsumme:</span>
                        <span>{calculateTotal().toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>

                {projectForm.watch('notes') && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Notizen</h3>
                    <p className="text-sm text-gray-600">{projectForm.watch('notes')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Zurück
              </Button>
              <Button onClick={finishWizard} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Projekt erstellen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}