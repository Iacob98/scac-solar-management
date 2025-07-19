import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/hooks/useI18n';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { 
  FolderOpen, 
  Users, 
  Wrench, 
  FileText,
  Building,
  UserCircle,
  TrendingUp,
  Calendar,
  Sun,
  Play
} from 'lucide-react';
import type { Project, Client, Crew } from '@shared/schema';
import { useState, useEffect } from 'react';
import Tutorial from '@/components/Tutorial';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/projects?firmId=${selectedFirmId}`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/clients?firmId=${selectedFirmId}`);
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/crews?firmId=${selectedFirmId}`);
      if (!response.ok) throw new Error('Failed to fetch crews');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  const activeProjects = projects.filter(p => p.status === 'in_progress').length;
  const totalClients = clients.length;
  const activeCrews = crews.filter(c => !c.archived).length;

  const quickActions = [
    {
      title: 'Проекты',
      description: 'Управление проектами установки солнечных панелей',
      icon: FolderOpen,
      href: '/projects',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Клиенты',
      description: 'Управление базой клиентов',
      icon: Users,
      href: '/clients',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Бригады',
      description: 'Управление установочными бригадами',
      icon: Wrench,
      href: '/crews',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'Счета',
      description: 'Управление счетами и оплатами',
      icon: FileText,
      href: '/invoices',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ];

  if (user?.role === 'admin') {
    quickActions.push(
      {
        title: 'Фирмы',
        description: 'Управление компаниями',
        icon: Building,
        href: '/admin/firms',
        color: 'text-red-600',
        bgColor: 'bg-red-50'
      },
      {
        title: 'Пользователи',
        description: 'Управление пользователями системы',
        icon: UserCircle,
        href: '/admin/users',
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50'
      }
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8">
          <h1 className="text-3xl font-bold mb-2">
            Добро пожаловать, {user?.firstName} {user?.lastName}!
          </h1>
          <p className="text-blue-100 text-lg">
            Система управления проектами установки солнечных панелей
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Сегодня: {new Date().toLocaleDateString('ru-RU')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <UserCircle className="w-4 h-4" />
                <span>Роль: {user?.role === 'admin' ? 'Администратор' : 'Руководитель проектов'}</span>
              </div>
            </div>
            <Button 
              variant="secondary" 
              onClick={() => setIsTutorialOpen(true)}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Play className="w-4 h-4 mr-2" />
              Начать туториал
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${action.bgColor}`}>
                        <action.icon className={`w-6 h-6 ${action.color}`} />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm">{action.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Stats Overview */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрая статистика</h2>
          {selectedFirmId ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Активные проекты</p>
                      <p className="text-2xl font-bold text-gray-900">{activeProjects}</p>
                      <p className="text-xs text-gray-500 mt-1">Из {projects.length} общих</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Всего клиентов</p>
                      <p className="text-2xl font-bold text-gray-900">{totalClients}</p>
                      <p className="text-xs text-gray-500 mt-1">В базе данных</p>
                    </div>
                    <Users className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Активные бригады</p>
                      <p className="text-2xl font-bold text-gray-900">{activeCrews}</p>
                      <p className="text-xs text-gray-500 mt-1">Из {crews.length} общих</p>
                    </div>
                    <Wrench className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-600">Выберите фирму в верхнем меню для просмотра статистики</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        <Tutorial 
          isOpen={isTutorialOpen} 
          onClose={() => setIsTutorialOpen(false)}
          onComplete={() => {
            setIsTutorialOpen(false);
            toast({
              title: 'Руководство завершено',
              description: 'Теперь вы готовы к работе с системой!',
            });
          }}
        />
      </div>
    </MainLayout>
  );
}
