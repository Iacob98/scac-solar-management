import { useI18n } from '@/hooks/useI18n';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Settings, 
  Receipt, 
  TrendingUp, 
  Users 
} from 'lucide-react';

interface StatsCardsProps {
  firmId: string;
}

export function StatsCards({ firmId }: StatsCardsProps) {
  const { t, formatCurrency } = useI18n();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/stats', { firmId }],
    enabled: !!firmId,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: t('activeProjects'),
      value: stats?.activeProjects || 0,
      icon: Settings,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: t('pendingInvoices'),
      value: formatCurrency(stats?.pendingInvoices || 0),
      icon: Receipt,
      color: 'bg-yellow-100 text-yellow-600',
    },
    {
      title: t('monthlyRevenue'),
      value: formatCurrency(stats?.monthlyRevenue || 0),
      icon: TrendingUp,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: t('activeCrews'),
      value: stats?.activeCrews || 0,
      icon: Users,
      color: 'bg-purple-100 text-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <Card key={index} className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
