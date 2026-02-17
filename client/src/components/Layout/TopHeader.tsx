import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, ChevronDown, Settings, LogOut, Image, MessageSquare, CheckCircle2, Check } from 'lucide-react';
import type { Firm } from '@shared/schema';

// Notification type from API
interface NotificationItem {
  id: number;
  userId: string;
  projectId: number | null;
  type: 'file_added' | 'note_added' | 'status_change' | 'report_added' | 'reclamation_created';
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  sourceUserId: string | null;
  createdAt: string;
  sourceUserFirstName: string | null;
  sourceUserLastName: string | null;
  sourceUserProfileImage: string | null;
}

// Преобразование URL аватара в публичный формат
const getAvatarUrl = (url?: string | null) => {
  if (!url) return null;
  // Преобразуем старый формат /api/files/download/xxx в новый /api/files/avatar/xxx
  if (url.includes('/api/files/download/')) {
    return url.replace('/api/files/download/', '/api/files/avatar/');
  }
  return url;
};

// Format relative time in Russian
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;
  return date.toLocaleDateString('ru-RU');
};

// Get icon for notification type
const getNotificationIcon = (type: NotificationItem['type']) => {
  switch (type) {
    case 'file_added':
      return <Image className="w-4 h-4 text-blue-500" />;
    case 'note_added':
      return <MessageSquare className="w-4 h-4 text-green-500" />;
    case 'status_change':
      return <CheckCircle2 className="w-4 h-4 text-orange-500" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

export function TopHeader() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [selectedFirmId, setSelectedFirmId] = useState<string>(() => {
    // Initialize with saved value immediately to prevent flashing
    return localStorage.getItem('selectedFirmId') || '';
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  const { data: firms = [] } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
    enabled: !!user,
  });

  // Fetch notifications - auto-refresh every 10 seconds
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications'],
    enabled: !!user,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time feel
    refetchIntervalInBackground: true, // Keep fetching even when tab is not focused
  });

  // Fetch unread count - auto-refresh every 10 seconds
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread-count'],
    enabled: !!user,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const unreadCount = unreadData?.count || 0;

  // Mark notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to mark as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to mark all as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
  });

  // Handle notification click
  const handleNotificationClick = (notification: NotificationItem) => {
    // Mark as read
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    // Navigate to link
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  useEffect(() => {
    // Initialize firm selection once firms are loaded
    if (firms.length > 0 && !hasInitialized) {
      const savedFirmId = localStorage.getItem('selectedFirmId');
      console.log('Initializing firm selection:', { savedFirmId, firms: firms.map(f => f.id) });
      
      if (savedFirmId && firms.some(firm => String(firm.id) === savedFirmId)) {
        // Restore saved valid firm
        console.log('Restoring saved firm:', savedFirmId);
        setSelectedFirmId(savedFirmId);
      } else if (savedFirmId && !firms.some(firm => String(firm.id) === savedFirmId)) {
        // Clear invalid saved firm ID and auto-select
        console.log('Clearing invalid saved firm ID:', savedFirmId);
        localStorage.removeItem('selectedFirmId');
        if (profile?.role === 'admin' || firms.length === 1) {
          const firstFirmId = String(firms[0].id);
          console.log('Auto-selecting first firm after clearing invalid:', firstFirmId);
          setSelectedFirmId(firstFirmId);
          localStorage.setItem('selectedFirmId', firstFirmId);
        } else {
          setSelectedFirmId('');
        }
      } else if (!savedFirmId && (profile?.role === 'admin' || firms.length === 1)) {
        // Auto-select for new users
        const firstFirmId = String(firms[0].id);
        console.log('Auto-selecting first firm for new user:', firstFirmId);
        setSelectedFirmId(firstFirmId);
        localStorage.setItem('selectedFirmId', firstFirmId);
      }
      
      setHasInitialized(true);
    }
  }, [firms, hasInitialized, user]);

  const handleFirmChange = (firmId: string) => {
    console.log('Firm change requested:', { from: selectedFirmId, to: firmId });
    // Only change if it's actually different
    if (firmId !== selectedFirmId) {
      console.log('Changing firm from', selectedFirmId, 'to', firmId);
      setSelectedFirmId(firmId);
      localStorage.setItem('selectedFirmId', firmId);
      // Trigger page refresh to update data
      window.location.reload();
    } else {
      console.log('Firm change ignored - same as current');
    }
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        {/* Firm Selector */}
        <Select value={selectedFirmId} onValueChange={handleFirmChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Выберите фирму" />
          </SelectTrigger>
          <SelectContent>
            {firms.map((firm) => (
              <SelectItem key={firm.id} value={String(firm.id)}>
                {firm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


      </div>

      <div className="flex items-center space-x-4">
        {/* Notification Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-medium px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="font-semibold text-sm">Уведомления</span>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2"
                  onClick={() => markAllReadMutation.mutate()}
                >
                  <Check className="w-3 h-3 mr-1" />
                  Прочитать все
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                Нет уведомлений
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {notification.title}
                      </div>
                      <div className="text-xs text-gray-600 line-clamp-2">
                        {notification.message}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
              <img
                src={getAvatarUrl(profile?.profile_image_url) || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=32&h=32"}
                alt="User Avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="text-sm">
                <p className="font-medium">
                  {profile?.first_name} {profile?.last_name}
                </p>
                <p className="text-gray-500">{profile?.role === 'admin' ? 'Администратор' : 'Руководитель проектов'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
              <Settings className="w-4 h-4 mr-2" />
              Настройки
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={async () => {
              console.log('[TopHeader] Logout clicked');
              try {
                const { error } = await signOut();
                console.log('[TopHeader] signOut completed', { error });
                localStorage.removeItem('selectedFirmId');
                window.location.href = '/login';
              } catch (err) {
                console.error('[TopHeader] Logout error:', err);
                // Всё равно редиректим на логин
                localStorage.removeItem('selectedFirmId');
                window.location.href = '/login';
              }
            }}>
              <LogOut className="w-4 h-4 mr-2" />
              Выход
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
