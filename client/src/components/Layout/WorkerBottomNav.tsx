import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Home, Calendar, FolderOpen, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const baseNavItems: Omit<NavItem, 'badge'>[] = [
  { path: '/worker', label: 'Главная', icon: Home },
  { path: '/worker/reclamations', label: 'Рекламации', icon: AlertTriangle },
  { path: '/worker/projects', label: 'Проекты', icon: FolderOpen },
  { path: '/worker/calendar', label: 'Календарь', icon: Calendar },
  { path: '/worker/profile', label: 'Профиль', icon: User },
];

interface ReclamationCount {
  activeCount: number;
  availableCount: number;
  totalCount: number;
}

export function WorkerBottomNav() {
  const [location] = useLocation();

  // Fetch reclamation count for badge
  const { data: reclamationCount } = useQuery<ReclamationCount>({
    queryKey: ['/api/worker/reclamations/count'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/reclamations/count', 'GET');
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Build nav items with badge
  const navItems: NavItem[] = baseNavItems.map((item) => {
    if (item.path === '/worker/reclamations' && reclamationCount?.totalCount) {
      return { ...item, badge: reclamationCount.totalCount };
    }
    return item;
  });

  const isActive = (path: string) => {
    if (path === '/worker') {
      return location === '/worker' || location === '/worker/';
    }
    return location.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          const isReclamation = item.path === '/worker/reclamations';

          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex flex-col items-center justify-center w-full h-full px-2 py-1 relative',
                'transition-colors duration-200',
                active
                  ? isReclamation ? 'text-red-600' : 'text-primary'
                  : isReclamation && item.badge ? 'text-red-500' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 mb-1',
                    active && (isReclamation ? 'text-red-600' : 'text-primary'),
                    !active && isReclamation && item.badge && 'text-red-500'
                  )}
                />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs',
                  active ? 'font-semibold' : 'font-medium'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
