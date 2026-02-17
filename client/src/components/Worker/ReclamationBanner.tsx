import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ReclamationCount {
  activeCount: number;
  availableCount: number;
  totalCount: number;
}

export function ReclamationBanner() {
  const { data: counts } = useQuery<ReclamationCount>({
    queryKey: ['/api/worker/reclamations/count'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/reclamations/count', 'GET');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (!counts || counts.totalCount === 0) {
    return null;
  }

  return (
    <Link href="/worker/reclamations">
      <div className="bg-red-600 text-white p-4 rounded-lg shadow-lg mb-4 cursor-pointer hover:bg-red-700 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 p-2 rounded-full">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {counts.activeCount > 0 ? (
                  <>Рекламации: {counts.activeCount}</>
                ) : (
                  <>Доступные рекламации: {counts.availableCount}</>
                )}
              </h3>
              <p className="text-red-100 text-sm">
                {counts.activeCount > 0
                  ? 'Требуется исправление качества работы'
                  : 'Вы можете взять эти рекламации'}
              </p>
            </div>
          </div>
          <ArrowRight className="w-6 h-6" />
        </div>
      </div>
    </Link>
  );
}
