import { useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Building, Globe, Key, MapPin, Hash } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const firmSchema = z.object({
  name: z.string().min(1, 'Firmenname ist erforderlich'),
  invoiceNinjaUrl: z.string().url('Ungültige URL'),
  token: z.string().min(1, 'API-Token ist erforderlich'),
  address: z.string().optional(),
  taxId: z.string().optional(),
  logoUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
});

export default function Firms() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFirm, setEditingFirm] = useState<any>(null);

  const form = useForm<z.infer<typeof firmSchema>>({
    resolver: zodResolver(firmSchema),
    defaultValues: {
      name: '',
      invoiceNinjaUrl: '',
      token: '',
      address: '',
      taxId: '',
      logoUrl: '',
    },
  });

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Zugriff verweigert
          </h1>
          <p className="text-gray-600">
            Sie haben keine Berechtigung, diese Seite zu besuchen.
          </p>
        </div>
      </MainLayout>
    );
  }

  const { data: firms = [], isLoading } = useQuery({
    queryKey: ['/api/firms'],
  });

  const createFirmMutation = useMutation({
    mutationFn: async (data: z.infer<typeof firmSchema>) => {
      const response = await apiRequest('POST', '/api/firms', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Firma erfolgreich erstellt',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/firms'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof firmSchema>) => {
    createFirmMutation.mutate(data);
  };

  const openEditDialog = (firm: any) => {
    setEditingFirm(firm);
    form.reset({
      name: firm.name,
      invoiceNinjaUrl: firm.invoiceNinjaUrl,
      token: firm.token,
      address: firm.address || '',
      taxId: firm.taxId || '',
      logoUrl: firm.logoUrl || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFirm(null);
    form.reset();
  };

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('firms')}</h1>
            <p className="text-gray-600 mt-1">Verwalten Sie Firmen und deren Invoice Ninja Konfiguration</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white">
                <Plus className="w-4 h-4 mr-2" />
                Neue Firma hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingFirm ? 'Firma bearbeiten' : 'Neue Firma hinzufügen'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Firmenname</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="SolarTech München GmbH"
                    />
                    {form.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="taxId">Steuernummer</Label>
                    <Input
                      id="taxId"
                      {...form.register('taxId')}
                      placeholder="DE123456789"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    {...form.register('address')}
                    placeholder="Musterstraße 123, 80331 München"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Invoice Ninja Konfiguration</h3>
                  
                  <div>
                    <Label htmlFor="invoiceNinjaUrl">Invoice Ninja URL</Label>
                    <Input
                      id="invoiceNinjaUrl"
                      {...form.register('invoiceNinjaUrl')}
                      placeholder="https://invoicing.co"
                    />
                    {form.formState.errors.invoiceNinjaUrl && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.invoiceNinjaUrl.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="token">API Token</Label>
                    <Input
                      id="token"
                      type="password"
                      {...form.register('token')}
                      placeholder="Ihr Invoice Ninja API Token"
                    />
                    {form.formState.errors.token && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.token.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="logoUrl">Logo URL (optional)</Label>
                  <Input
                    id="logoUrl"
                    {...form.register('logoUrl')}
                    placeholder="https://example.com/logo.png"
                  />
                  {form.formState.errors.logoUrl && (
                    <p className="text-red-500 text-sm mt-1">
                      {form.formState.errors.logoUrl.message}
                    </p>
                  )}
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    disabled={createFirmMutation.isPending}
                    className="flex-1"
                  >
                    {createFirmMutation.isPending ? t('loading') : t('save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeDialog}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-32 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6">
              {firms.map((firm: any) => (
                <Card key={firm.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Building className="w-5 h-5 text-primary" />
                        <span>{firm.name}</span>
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(firm)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        {firm.taxId && (
                          <div className="flex items-center space-x-2 text-sm">
                            <Hash className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">Steuernummer:</span>
                            <span className="font-medium">{firm.taxId}</span>
                          </div>
                        )}
                        {firm.address && (
                          <div className="flex items-start space-x-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <span className="text-gray-600">Adresse:</span>
                            <span className="font-medium">{firm.address}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                          <Globe className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Invoice Ninja:</span>
                          <span className="font-medium">{firm.invoiceNinjaUrl}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm">
                          <Key className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">API Token:</span>
                          <span className="font-medium">●●●●●●●●</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Erstellt: {new Date(firm.createdAt).toLocaleDateString('de-DE')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
