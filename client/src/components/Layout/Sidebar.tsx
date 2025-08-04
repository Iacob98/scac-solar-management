import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@shared/i18n';

export function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    { path: '/projects', label: t('проекты', 'Проекты'), icon: 'dashboard' },
    { path: '/clients', label: t('клиенты', 'Клиенты'), icon: 'people' },
    { path: '/crews', label: t('бригады', 'Бригады'), icon: 'groups' },
    { path: '/crews/statistics', label: t('статистика', 'Статистика'), icon: 'analytics' },
    { path: '/calendar', label: t('календарь', 'Календарь'), icon: 'event' },
    ...(user?.role === 'admin' ? [{ path: '/invoices', label: t('счета', 'Счета'), icon: 'receipt' }] : []),
  ];

  const adminItems = [
    { path: '/admin/firms', label: t('управление_фирмами', 'Управление фирмами'), icon: 'domain_add' },
    { path: '/admin/users', label: t('пользователи', 'Пользователи'), icon: 'admin_panel_settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/crews/statistics') {
      return location === '/crews/statistics';
    }
    if (path === '/crews') {
      return location === '/crews' || location.startsWith('/crews/');
    }
    return location === path || (path !== '/' && location.startsWith(path + '/'));
  };

  return (
    <aside className="w-60 bg-white shadow-lg flex flex-col border-r">
      <div className="p-6 border-b">
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-icons text-white text-lg">wb_sunny</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">SCAC</h1>
              <p className="text-xs text-gray-500">Solar Management</p>
            </div>
          </div>
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link key={item.path} href={item.path}>
            <div
              className={`sidebar-item flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                isActive(item.path)
                  ? 'bg-blue-50 text-primary'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-primary'
              }`}
            >
              <span className="material-icons">{item.icon}</span>
              <span className={isActive(item.path) ? 'font-medium' : ''}>{item.label}</span>
            </div>
          </Link>
        ))}
        
        {user?.role === 'admin' && (
          <div className="pt-4 border-t">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
              {t('администрирование', 'Администрирование')}
            </p>
            {adminItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div
                  className={`sidebar-item flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-primary'
                      : 'text-gray-600 hover:bg-blue-50 hover:text-primary'
                  }`}
                >
                  <span className="material-icons">{item.icon}</span>
                  <span className={isActive(item.path) ? 'font-medium' : ''}>{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </nav>
    </aside>
  );
}
