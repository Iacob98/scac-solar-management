import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

const projectSchema = z.object({
  clientId: z.number().min(1, 'Client is required'),
  crewId: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().optional(),
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
  const [activeTab, setActiveTab] = useState('basic');
  const [services, setServices] = useState<Array<{
    id: string;
    productKey: string;
    description: string;
    price: string;
    quantity: string;
    isCustom: boolean;
  }>>([]);

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', { firmId }],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', { firmId }],
    enabled: !!firmId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['/api/catalog/products', { firmId }],
    enabled: !!firmId,
  });

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      clientId: 0,
      crewId: 0,
      startDate: '',
      endDate: '',
      notes: '',
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/projects', {
        ...data,
        firmId,
      });
      return response.json();
    },
    onSuccess: (project) => {
      // Create services for the project
      const servicePromises = services.map(service => 
        apiRequest('POST', '/api/services', {
          projectId: project.id,
          productKey: service.productKey,
          description: service.description,
          price: service.price,
          quantity: service.quantity,
          isCustom: service.isCustom,
        })
      );

      Promise.all(servicePromises).then(() => {
        toast({
          title: t('success'),
          description: 'Projekt erfolgreich erstellt',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        onClose();
        form.reset();
        setServices([]);
        setActiveTab('basic');
      });
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addService = () => {
    setServices([...services, {
      id: Date.now().toString(),
      productKey: '',
      description: '',
      price: '0.00',
      quantity: '1.00',
      isCustom: false,
    }]);
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id: string, field: string, value: any) => {
    setServices(services.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const selectProduct = (serviceId: string, productKey: string) => {
    const product = products.find((p: any) => p.product_key === productKey);
    if (product) {
      updateService(serviceId, 'productKey', product.product_key);
      updateService(serviceId, 'description', product.notes || '');
      updateService(serviceId, 'price', product.price.toString());
      updateService(serviceId, 'isCustom', false);
    }
  };

  const onSubmit = (data: z.infer<typeof projectSchema>) => {
    if (services.length === 0) {
      toast({
        title: t('error'),
        description: 'Mindestens eine Dienstleistung ist erforderlich',
        variant: 'destructive',
      });
      return;
    }

    createProjectMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('newProject')}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
            <TabsTrigger value="services">{t('services')}</TabsTrigger>
            <TabsTrigger value="completion">{t('completion')}</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientId">{t('client')}</Label>
                <Select
                  value={form.watch('clientId')?.toString()}
                  onValueChange={(value) => form.setValue('clientId', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('client')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client: any) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="crewId">{t('crew')}</Label>
                <Select
                  value={form.watch('crewId')?.toString()}
                  onValueChange={(value) => form.setValue('crewId', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('crew')} />
                  </SelectTrigger>
                  <SelectContent>
                    {crews.map((crew: any) => (
                      <SelectItem key={crew.id} value={crew.id.toString()}>
                        {crew.name} - {crew.leaderName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startDate">{t('startDate')}</Label>
                <Input
                  type="date"
                  {...form.register('startDate')}
                />
              </div>

              <div>
                <Label htmlFor="endDate">{t('endDate')}</Label>
                <Input
                  type="date"
                  {...form.register('endDate')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea
                {...form.register('notes')}
                placeholder={t('notes')}
              />
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">{t('services')}</h3>
              <Button onClick={addService} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                {t('add')}
              </Button>
            </div>

            <div className="space-y-4">
              {services.map((service) => (
                <Card key={service.id}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Service {services.indexOf(service) + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeService(service.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Produkt</Label>
                        <Select
                          value={service.productKey}
                          onValueChange={(value) => selectProduct(service.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Produkt auswählen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">Benutzerdefiniert</SelectItem>
                            {products.map((product: any) => (
                              <SelectItem key={product.id} value={product.product_key}>
                                {product.product_key} - {product.notes}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>{t('description')}</Label>
                        <Input
                          value={service.description}
                          onChange={(e) => updateService(service.id, 'description', e.target.value)}
                          placeholder={t('description')}
                        />
                      </div>

                      <div>
                        <Label>{t('price')}</Label>
                        <CurrencyInput
                          value={service.price}
                          onChange={(value) => updateService(service.id, 'price', value)}
                        />
                      </div>

                      <div>
                        <Label>{t('quantity')}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={service.quantity}
                          onChange={(e) => updateService(service.id, 'quantity', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="completion" className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Projekt bereit zum Erstellen</h3>
              <p className="text-gray-600 mb-6">
                Überprüfen Sie alle Angaben und erstellen Sie das Projekt.
              </p>
              <Button
                onClick={form.handleSubmit(onSubmit)}
                disabled={createProjectMutation.isPending}
                size="lg"
              >
                {createProjectMutation.isPending ? t('loading') : t('create')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
