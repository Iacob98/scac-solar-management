import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/Layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { GoogleCalendarWidget } from '@/components/GoogleCalendarWidget';
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
  const { toast } = useToast();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  // Fetch home statistics from new API endpoint
  const { data: homeStats } = useQuery({
    queryKey: ['/api/stats/home'],
    queryFn: async () => {
      const response = await fetch('/api/stats/home');
      if (!response.ok) throw new Error('Failed to fetch home statistics');
      return response.json();
    },
  });

  // Use statistics from API
  const totalProjects = homeStats?.totalProjects || 0;
  const activeProjects = homeStats?.activeProjects || 0;
  const completedProjects = homeStats?.completedProjects || 0;
  const totalClients = homeStats?.totalClients || 0;
  const totalCrews = homeStats?.totalCrews || 0;
  const recentProjects = homeStats?.recentProjects || [];

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
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Общая статистика</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Всего проектов</p>
                    <p className="text-2xl font-bold text-gray-900">{totalProjects}</p>
                    <p className="text-xs text-gray-500 mt-1">Во всех фирмах</p>
                  </div>
                  <FolderOpen className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Активные проекты</p>
                    <p className="text-2xl font-bold text-gray-900">{activeProjects}</p>
                    <p className="text-xs text-gray-500 mt-1">В работе</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Всего клиентов</p>
                    <p className="text-2xl font-bold text-gray-900">{totalClients}</p>
                    <p className="text-xs text-gray-500 mt-1">В базе</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Всего бригад</p>
                    <p className="text-2xl font-bold text-gray-900">{totalCrews}</p>
                    <p className="text-xs text-gray-500 mt-1">Доступных</p>
                  </div>
                  <Wrench className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Projects */}
        {recentProjects.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Последние проекты</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.slice(0, 6).map((project: any) => (
                <Card key={project.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Sun className="w-4 h-4 text-yellow-600" />
                        <span className="font-medium text-sm">
                          Проект #{project.id}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        project.status === 'completed' || project.status === 'paid' 
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'invoiced' || project.status === 'invoice_sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {project.status === 'planning' ? 'Планирование' :
                         project.status === 'work_in_progress' ? 'В процессе' :
                         project.status === 'completed' ? 'Завершён' :
                         project.status === 'invoiced' ? 'Выставлен счет' :
                         project.status === 'invoice_sent' ? 'Счет отправлен' :
                         project.status === 'paid' ? 'Оплачен' : project.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {project.installationPersonFirstName} {project.installationPersonLastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {project.installationPersonAddress}
                    </p>
                    {project.invoiceNumber && (
                      <p className="text-xs text-blue-600 mt-1">
                        Счет: #{project.invoiceNumber}
                      </p> 
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
        
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

        {/* Интегрированный Google Calendar виджет */}
        {selectedFirmId && (
          <div className="mt-8">
            <GoogleCalendarWidget 
              firmId={selectedFirmId} 
              className="w-full"
              maxEvents={5}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
}
