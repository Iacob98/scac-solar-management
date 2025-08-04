import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, ChevronDown, Settings, LogOut, UserCircle, Languages } from 'lucide-react';
import type { Firm } from '@shared/schema';
import { useTranslations } from '@/hooks/useTranslations';

export function TopHeader() {
  const { user } = useAuth();
  const { t, language, setLanguage } = useTranslations();
  const [selectedFirmId, setSelectedFirmId] = useState<string>(() => {
    // Initialize with saved value immediately to prevent flashing
    return localStorage.getItem('selectedFirmId') || '';
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  const { data: firms = [] } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
    enabled: !!user,
  });

  useEffect(() => {
    // Initialize firm selection once firms are loaded
    if (firms.length > 0 && !hasInitialized) {
      const savedFirmId = localStorage.getItem('selectedFirmId');
      console.log('Initializing firm selection:', { savedFirmId, firms: firms.map(f => f.id) });
      
      if (savedFirmId && firms.some(firm => firm.id === savedFirmId)) {
        // Restore saved valid firm
        console.log('Restoring saved firm:', savedFirmId);
        setSelectedFirmId(savedFirmId);
      } else if (savedFirmId && !firms.some(firm => firm.id === savedFirmId)) {
        // Clear invalid saved firm ID and auto-select
        console.log('Clearing invalid saved firm ID:', savedFirmId);
        localStorage.removeItem('selectedFirmId');
        if (user?.role === 'admin' || firms.length === 1) {
          const firstFirmId = firms[0].id;
          console.log('Auto-selecting first firm after clearing invalid:', firstFirmId);
          setSelectedFirmId(firstFirmId);
          localStorage.setItem('selectedFirmId', firstFirmId);
        } else {
          setSelectedFirmId('');
        }
      } else if (!savedFirmId && (user?.role === 'admin' || firms.length === 1)) {
        // Auto-select for new users
        const firstFirmId = firms[0].id;
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
            <SelectValue placeholder={t('выберите_фирму', 'Выберите фирму')} />
          </SelectTrigger>
          <SelectContent>
            {firms.map((firm) => (
              <SelectItem key={firm.id} value={firm.id}>
                {firm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


      </div>

      <div className="flex items-center space-x-4">
        {/* Language Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Languages className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLanguage('ru')}>
              🇷🇺 Русский
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLanguage('de')}>
              🇩🇪 Deutsch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </Button>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
              <img
                src={user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=32&h=32"}
                alt="User Avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
              <div className="text-sm">
                <p className="font-medium">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-gray-500">{user?.role === 'admin' ? 'Администратор' : 'Руководитель проектов'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user?.role === 'admin' && (
              <>
                <DropdownMenuItem onClick={() => window.location.href = '/translations'}>
                  <Languages className="w-4 h-4 mr-2" />
                  Управление переводами
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
              <Settings className="w-4 h-4 mr-2" />
              {t('настройки', 'Настройки')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('выйти', 'Выйти')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
