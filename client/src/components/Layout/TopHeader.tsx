import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Bell, ChevronDown, Settings, LogOut, UserCircle } from 'lucide-react';
import type { Firm } from '@shared/schema';

export function TopHeader() {
  const { t, language, changeLanguage } = useI18n();
  const { user } = useAuth();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');

  const { data: firms = [] } = useQuery<Firm[]>({
    queryKey: ['/api/firms'],
    enabled: !!user,
  });

  useEffect(() => {
    // Auto-select first firm if available and none selected
    if (firms.length > 0 && !selectedFirmId) {
      const firstFirmId = firms[0].id;
      setSelectedFirmId(firstFirmId);
      localStorage.setItem('selectedFirmId', firstFirmId);
    }
  }, [firms, selectedFirmId]);

  useEffect(() => {
    // Load selected firm from localStorage on mount
    const savedFirmId = localStorage.getItem('selectedFirmId');
    if (savedFirmId) {
      setSelectedFirmId(savedFirmId);
    }
  }, []);

  const handleFirmChange = (firmId: string) => {
    setSelectedFirmId(firmId);
    localStorage.setItem('selectedFirmId', firmId);
    // Trigger page refresh to update data
    window.location.reload();
  };

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        {/* Firm Selector */}
        <Select value={selectedFirmId} onValueChange={handleFirmChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Firma auswählen" />
          </SelectTrigger>
          <SelectContent>
            {firms.map((firm) => (
              <SelectItem key={firm.id} value={firm.id}>
                {firm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Global Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder={`${t('projects')}, ${t('clients')} ${t('search').toLowerCase()}...`}
            className="w-64 pl-10"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Language Switch */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <Button
            variant={language === 'de' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => changeLanguage('de')}
            className="px-3 py-1 text-sm"
          >
            DE
          </Button>
          <Button
            variant={language === 'ru' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => changeLanguage('ru')}
            className="px-3 py-1 text-sm"
          >
            RU
          </Button>
        </div>

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
                <p className="text-gray-500">{user?.role === 'admin' ? 'Administrator' : 'Project Leiter'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              {t('settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = '/api/logout'}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
