import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Filter } from 'lucide-react';

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
  const { data: clients = [] } = useQuery({
    queryKey: ['/api/clients', firmId],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', firmId],
    enabled: !!firmId,
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filter</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="client-filter">Kunde</Label>
            <Select value={filters.clientId} onValueChange={(value) => onFilterChange('clientId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Kunden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Kunden</SelectItem>
                {clients.map((client: any) => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status-filter">Status</Label>
            <Select value={filters.status} onValueChange={(value) => onFilterChange('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Status</SelectItem>
                <SelectItem value="in_progress">In Bearbeitung</SelectItem>
                <SelectItem value="done">Abgeschlossen</SelectItem>
                <SelectItem value="invoiced">Fakturiert</SelectItem>
                <SelectItem value="paid">Bezahlt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="crew-filter">Crew</Label>
            <Select value={filters.crewId} onValueChange={(value) => onFilterChange('crewId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Alle Crews" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Crews</SelectItem>
                {crews.map((crew: any) => (
                  <SelectItem key={crew.id} value={crew.id.toString()}>
                    {crew.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="start-date">Startdatum</Label>
            <Input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="end-date">Enddatum</Label>
            <Input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}