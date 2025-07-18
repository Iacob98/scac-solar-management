import { useI18n } from '@/hooks/useI18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery } from '@tanstack/react-query';

interface FilterPanelProps {
  firmId: string;
  filters: {
    clientId: string;
    status: string;
    crewId: string;
    startDate: string;
    endDate: string;
  };
  onFilterChange: (key: string, value: string) => void;
}

export function FilterPanel({ firmId, filters, onFilterChange }: FilterPanelProps) {
  const { t } = useI18n();

  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', { firmId }],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', { firmId }],
    enabled: !!firmId,
  });

  const statusOptions = [
    { value: '', label: t('allStatuses') },
    { value: 'in_progress', label: t('inProgress') },
    { value: 'done', label: t('done') },
    { value: 'invoiced', label: t('invoiced') },
    { value: 'paid', label: t('paid') },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1">{t('client')}</Label>
        <Select value={filters.clientId} onValueChange={(value) => onFilterChange('clientId', value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('allClients')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('allClients')}</SelectItem>
            {clients.map((client: any) => (
              <SelectItem key={client.id} value={client.id.toString()}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1">{t('status')}</Label>
        <Select value={filters.status} onValueChange={(value) => onFilterChange('status', value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('allStatuses')} />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1">{t('crew')}</Label>
        <Select value={filters.crewId} onValueChange={(value) => onFilterChange('crewId', value)}>
          <SelectTrigger>
            <SelectValue placeholder={t('allCrews')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('allCrews')}</SelectItem>
            {crews.map((crew: any) => (
              <SelectItem key={crew.id} value={crew.id.toString()}>
                {crew.name} - {crew.leaderName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1">{t('fromDate')}</Label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={(e) => onFilterChange('startDate', e.target.value)}
        />
      </div>

      <div>
        <Label className="text-sm font-medium text-gray-700 mb-1">{t('toDate')}</Label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(e) => onFilterChange('endDate', e.target.value)}
        />
      </div>
    </div>
  );
}
