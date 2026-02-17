import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  User,
  HandHelping,
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface Reclamation {
  id: number;
  projectId: number;
  description: string;
  deadline: string;
  status: string;
  currentCrewId: number;
  originalCrewId: number;
  createdAt: string;
  project: {
    id: number;
    status: string;
    installationPersonAddress: string | null;
    installationPersonFirstName: string | null;
    installationPersonLastName: string | null;
  } | null;
  client: {
    name: string;
    address: string | null;
  } | null;
}

interface ReclamationsData {
  assigned: Reclamation[];
  available: Reclamation[];
  totalCount: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" /> },
  accepted: { label: 'Принята', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { label: 'Отклонена', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> },
  in_progress: { label: 'В работе', color: 'bg-purple-100 text-purple-800', icon: <Clock className="w-4 h-4" /> },
  completed: { label: 'Завершена', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
};

export default function WorkerReclamations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReclamation, setSelectedReclamation] = useState<Reclamation | null>(null);
  const [dialogType, setDialogType] = useState<'accept' | 'reject' | 'complete' | 'take' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');

  const { data, isLoading } = useQuery<ReclamationsData>({
    queryKey: ['/api/worker/reclamations'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/reclamations', 'GET');
      return response.json();
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/worker/reclamations/${id}/accept`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations/count'] });
      toast({ title: 'Успешно', description: 'Рекламация принята и добавлена в календарь' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message || 'Не удалось принять рекламацию', variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const response = await apiRequest(`/api/worker/reclamations/${id}/reject`, 'POST', { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations/count'] });
      toast({ title: 'Успешно', description: 'Рекламация отклонена. Администратор уведомлён.' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message || 'Не удалось отклонить рекламацию', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const response = await apiRequest(`/api/worker/reclamations/${id}/complete`, 'POST', { notes });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations/count'] });
      toast({ title: 'Успешно', description: 'Рекламация завершена!' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message || 'Не удалось завершить рекламацию', variant: 'destructive' });
    },
  });

  const takeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/worker/reclamations/${id}/take`, 'POST');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/worker/reclamations/count'] });
      toast({ title: 'Успешно', description: 'Рекламация взята вашей бригадой' });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message || 'Не удалось взять рекламацию', variant: 'destructive' });
    },
  });

  const closeDialog = () => {
    setDialogType(null);
    setSelectedReclamation(null);
    setRejectReason('');
    setCompleteNotes('');
  };

  const openDialog = (reclamation: Reclamation, type: 'accept' | 'reject' | 'complete' | 'take') => {
    setSelectedReclamation(reclamation);
    setDialogType(type);
  };

  const handleConfirm = () => {
    if (!selectedReclamation) return;

    switch (dialogType) {
      case 'accept':
        acceptMutation.mutate(selectedReclamation.id);
        break;
      case 'reject':
        if (rejectReason.trim().length < 10) {
          toast({ title: 'Ошибка', description: 'Причина должна быть минимум 10 символов', variant: 'destructive' });
          return;
        }
        rejectMutation.mutate({ id: selectedReclamation.id, reason: rejectReason });
        break;
      case 'complete':
        completeMutation.mutate({ id: selectedReclamation.id, notes: completeNotes });
        break;
      case 'take':
        takeMutation.mutate(selectedReclamation.id);
        break;
    }
  };

  const getAddress = (reclamation: Reclamation) => {
    return reclamation.project?.installationPersonAddress || reclamation.client?.address || 'Адрес не указан';
  };

  const getPersonName = (reclamation: Reclamation) => {
    if (reclamation.project) {
      const firstName = reclamation.project.installationPersonFirstName || '';
      const lastName = reclamation.project.installationPersonLastName || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ');
      if (fullName) return fullName;
    }
    return reclamation.client?.name || 'Неизвестно';
  };

  const isDeadlineSoon = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  const renderReclamationCard = (reclamation: Reclamation, isAvailable = false) => {
    const status = statusConfig[reclamation.status] || statusConfig.pending;
    const deadlineSoon = isDeadlineSoon(reclamation.deadline);

    return (
      <Card key={reclamation.id} className={`mb-4 ${deadlineSoon && reclamation.status !== 'completed' ? 'border-red-300 border-2' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{getPersonName(reclamation)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span className="line-clamp-1">{getAddress(reclamation)}</span>
              </div>
            </div>
            <Badge className={status.color}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
          </div>

          <div className="bg-red-50 p-3 rounded-md mb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{reclamation.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span className={deadlineSoon && reclamation.status !== 'completed' ? 'text-red-600 font-semibold' : ''}>
                Срок: {format(new Date(reclamation.deadline), 'd MMMM yyyy', { locale: ru })}
              </span>
            </div>
          </div>

          {isAvailable ? (
            <Button
              onClick={() => openDialog(reclamation, 'take')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <HandHelping className="w-4 h-4 mr-2" />
              Взять рекламацию
            </Button>
          ) : (
            <div className="flex gap-2">
              {reclamation.status === 'pending' && (
                <>
                  <Button
                    onClick={() => openDialog(reclamation, 'accept')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Принять
                  </Button>
                  <Button
                    onClick={() => openDialog(reclamation, 'reject')}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Отклонить
                  </Button>
                </>
              )}
              {(reclamation.status === 'accepted' || reclamation.status === 'in_progress') && (
                <Button
                  onClick={() => openDialog(reclamation, 'complete')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Завершить исправление
                </Button>
              )}
              {reclamation.status === 'completed' && (
                <div className="w-full text-center text-green-600 font-medium py-2">
                  <CheckCircle className="w-5 h-5 inline mr-2" />
                  Завершена
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <WorkerLayout title="Рекламации">
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !data || data.totalCount === 0 ? (
          <Card className="bg-gray-50 border-dashed">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет активных рекламаций</h3>
              <p className="text-gray-600">Отличная работа! У вашей бригады нет рекламаций.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Assigned reclamations */}
            {data.assigned.length > 0 && (
              <section className="mb-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  Ваши рекламации ({data.assigned.length})
                </h2>
                {data.assigned.map((r) => renderReclamationCard(r, false))}
              </section>
            )}

            {/* Available reclamations */}
            {data.available.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <HandHelping className="w-5 h-5 text-blue-600" />
                  Доступные для взятия ({data.available.length})
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  Эти рекламации были отклонены другими бригадами. Вы можете взять их.
                </p>
                {data.available.map((r) => renderReclamationCard(r, true))}
              </section>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={dialogType === 'accept'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Принять рекламацию?</DialogTitle>
            <DialogDescription>
              После принятия рекламация будет добавлена в ваш календарь на указанную дату.
              Администратор будет уведомлён.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={handleConfirm}
              disabled={acceptMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {acceptMutation.isPending ? 'Принимаем...' : 'Принять'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'reject'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить рекламацию?</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения. Администратор будет уведомлён и может переназначить
              рекламацию другой бригаде.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Причина отклонения (минимум 10 символов)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={handleConfirm}
              disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              variant="destructive"
            >
              {rejectMutation.isPending ? 'Отклоняем...' : 'Отклонить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'complete'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершить рекламацию?</DialogTitle>
            <DialogDescription>
              Подтвердите, что исправление выполнено. Вы можете добавить комментарий.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Комментарий к выполненной работе (необязательно)..."
            value={completeNotes}
            onChange={(e) => setCompleteNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={handleConfirm}
              disabled={completeMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {completeMutation.isPending ? 'Завершаем...' : 'Завершить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'take'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Взять рекламацию?</DialogTitle>
            <DialogDescription>
              Эта рекламация была отклонена другой бригадой. Вы уверены, что хотите взять её?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Отмена</Button>
            <Button
              onClick={handleConfirm}
              disabled={takeMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {takeMutation.isPending ? 'Берём...' : 'Взять'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkerLayout>
  );
}
