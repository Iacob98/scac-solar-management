import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const menuItems = [
    { path: '/projects', label: 'Проекты', icon: 'dashboard' },
    { path: '/clients', label: 'Клиенты', icon: 'people' },
    { path: '/crews', label: 'Бригады', icon: 'groups' },
    { path: '/files', label: 'Файлы', icon: 'folder_open' },
    ...(user?.role === 'admin' ? [{ path: '/invoices', label: 'Счета', icon: 'receipt' }] : []),
  ];

  const adminItems = [
    { path: '/admin/firms', label: 'Управление фирмами', icon: 'domain_add' },
    { path: '/admin/users', label: 'Пользователи', icon: 'admin_panel_settings' },
  ];

  const isActive = (path: string) => location === path;

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
              Администрирование
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
