import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, FileText, Euro, Users } from 'lucide-react';
import type { Project, Crew } from '@shared/schema';

interface StatsCardsProps {
  firmId: string;
}

export function StatsCards({ firmId }: StatsCardsProps) {
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', firmId],
    enabled: !!firmId,
  });

  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ['/api/crews', firmId],
    enabled: !!firmId,
  });

  const activeProjects = projects.filter((p) => p.status === 'in_progress').length;
  const completedProjects = projects.filter((p) => p.status === 'done').length;
  const invoicedProjects = projects.filter((p) => p.status === 'invoiced').length;
  const paidProjects = projects.filter((p) => p.status === 'paid').length;

  const stats = [
    {
      title: 'Aktive Projekte',
      value: activeProjects.toString(),
      icon: TrendingUp,
      description: 'Projekte in Bearbeitung',
      color: 'text-blue-600',
    },
    {
      title: 'Ausstehende Rechnungen',
      value: (completedProjects + invoicedProjects).toString(),
      icon: FileText,
      description: 'Zu fakturierende Projekte',
      color: 'text-orange-600',
    },
    {
      title: 'Monatsumsatz',
      value: '€ 45.750',
      icon: Euro,
      description: 'Geschätzter Umsatz',
      color: 'text-green-600',
    },
    {
      title: 'Aktive Crews',
      value: crews.filter((c) => !c.archived).length.toString(),
      icon: Users,
      description: 'Verfügbare Teams',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}