import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Phone, Users, Archive } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const crewSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  leaderName: z.string().min(1, 'Brigadeführer ist erforderlich'),
  phone: z.string().optional(),
});

export default function Crews() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);

  const form = useForm<z.infer<typeof crewSchema>>({
    resolver: zodResolver(crewSchema),
    defaultValues: {
      name: '',
      leaderName: '',
      phone: '',
    },
  });

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: crews = [], isLoading } = useQuery({
    queryKey: ['/api/crews', { firmId: selectedFirmId }],
    enabled: !!selectedFirmId,
  });

  const createCrewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof crewSchema>) => {
      const response = await apiRequest('POST', '/api/crews', {
        ...data,
        firmId: selectedFirmId,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Brigade erfolgreich erstellt',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
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

  const archiveCrewMutation = useMutation({
    mutationFn: async (crewId: number) => {
      const response = await apiRequest('DELETE', `/api/crews/${crewId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t('success'),
        description: 'Brigade erfolgreich archiviert',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crews'] });
    },
    onError: (error) => {
      toast({
        title: t('error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: z.infer<typeof crewSchema>) => {
    createCrewMutation.mutate(data);
  };

  const openEditDialog = (crew: any) => {
    setEditingCrew(crew);
    form.reset({
      name: crew.name,
      leaderName: crew.leaderName,
      phone: crew.phone || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCrew(null);
    form.reset();
  };

  const handleArchiveCrew = (crewId: number) => {
    if (confirm('Sind Sie sicher, dass Sie diese Brigade archivieren möchten?')) {
      archiveCrewMutation.mutate(crewId);
    }
  };

  const filteredCrews = showArchived 
    ? crews 
    : crews.filter((crew: any) => !crew.archived);

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {t('crews')}
          </h1>
          <p className="text-gray-600">
            Bitte wählen Sie eine Firma aus dem Header aus, um Brigaden zu verwalten.
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
            <h1 className="text-2xl font-semibold text-gray-900">{t('crews')}</h1>
            <p className="text-gray-600 mt-1">Verwalten Sie Ihre Installationsbrigaden</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                id="show-archived"
              />
              <Label htmlFor="show-archived" className="text-sm">
                Archivierte anzeigen
              </Label>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary-dark text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Neue Brigade hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingCrew ? 'Brigade bearbeiten' : 'Neue Brigade hinzufügen'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Brigade Name</Label>
                    <Input
                      id="name"
                      {...form.register('name')}
                      placeholder="z.B. Team Alpha"
                    />
                    {form.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="leaderName">Brigadeführer</Label>
                    <Input
                      id="leaderName"
                      {...form.register('leaderName')}
                      placeholder="Vollständiger Name"
                    />
                    {form.formState.errors.leaderName && (
                      <p className="text-red-500 text-sm mt-1">
                        {form.formState.errors.leaderName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="phone">{t('phone')}</Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="+49 123 456789"
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      type="submit"
                      disabled={createCrewMutation.isPending}
                      className="flex-1"
                    >
                      {createCrewMutation.isPending ? t('loading') : t('save')}
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
        </div>

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
                  <TableHead>Brigade Name</TableHead>
                  <TableHead>Brigadeführer</TableHead>
                  <TableHead>{t('phone')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>Erstellt</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrews.map((crew: any) => (
                  <TableRow key={crew.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{crew.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{crew.leaderName}</div>
                    </TableCell>
                    <TableCell>
                      {crew.phone ? (
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{crew.phone}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={crew.archived ? 'secondary' : 'default'}>
                        {crew.archived ? 'Archiviert' : 'Aktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600">
                        {new Date(crew.createdAt).toLocaleDateString('de-DE')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(crew)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {!crew.archived && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchiveCrew(crew.id)}
                            disabled={archiveCrewMutation.isPending}
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
