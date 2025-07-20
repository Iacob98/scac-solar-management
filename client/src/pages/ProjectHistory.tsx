import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, User, FileText, AlertCircle, Calendar, Package, Phone, Users, Upload, Trash2, Star, Share2 } from 'lucide-react';

interface ProjectHistoryEntry {
  id: number;
  projectId: number;
  userId: string;
  changeType: 'status_change' | 'date_update' | 'info_update' | 'created' | 'equipment_update' | 'call_update' | 'assignment_change' | 'shared' | 'file_added' | 'file_deleted' | 'report_added' | 'report_updated' | 'report_deleted';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
  createdAt: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
}

interface ProjectHistoryProps {
  projectId: number;
  onBack: () => void;
  embedded?: boolean;
  limit?: number;
}

const changeTypeIcons = {
  'status_change': AlertCircle,
  'date_update': Calendar,
  'info_update': FileText,
  'created': FileText,
  'equipment_update': Package,
  'call_update': Phone,
  'assignment_change': Users,
  'shared': Share2,
  'file_added': Upload,
  'file_deleted': Trash2,
  'report_added': Star,
  'report_updated': Star,
  'report_deleted': Trash2,
};

const changeTypeColors = {
  'status_change': 'bg-blue-100 text-blue-700',
  'date_update': 'bg-green-100 text-green-700',
  'info_update': 'bg-gray-100 text-gray-700',
  'created': 'bg-purple-100 text-purple-700',
  'equipment_update': 'bg-orange-100 text-orange-700',
  'call_update': 'bg-red-100 text-red-700',
  'assignment_change': 'bg-yellow-100 text-yellow-700',
  'shared': 'bg-indigo-100 text-indigo-700',
  'file_added': 'bg-emerald-100 text-emerald-700',
  'file_deleted': 'bg-rose-100 text-rose-700',
  'report_added': 'bg-amber-100 text-amber-700',
  'report_updated': 'bg-amber-100 text-amber-700',
  'report_deleted': 'bg-rose-100 text-rose-700',
};

const changeTypeLabels = {
  'status_change': 'Изменение статуса',
  'date_update': 'Изменение даты',
  'info_update': 'Обновление информации',
  'created': 'Создание',
  'equipment_update': 'Оборудование',
  'call_update': 'Звонок клиенту',
  'assignment_change': 'Назначение команды',
  'shared': 'Общий доступ',
  'file_added': 'Файл добавлен',
  'file_deleted': 'Файл удален',
  'report_added': 'Отчет создан',
  'report_updated': 'Отчет обновлен',
  'report_deleted': 'Отчет удален',
};

export default function ProjectHistory({ projectId, onBack, embedded = false, limit }: ProjectHistoryProps) {
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'history'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/history`);
      if (!response.ok) {
        throw new Error('Failed to fetch project history');
      }
      return response.json() as ProjectHistoryEntry[];
    },
    refetchInterval: 5000, // Автообновление каждые 5 секунд
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ошибка загрузки</h3>
          <p className="text-gray-500">Не удалось загрузить историю проекта</p>
        </div>
      </div>
    );
  }

  if (embedded) {
    const displayHistory = limit ? history.slice(0, limit) : history;
    
    return (
      <div className="space-y-2">
        {displayHistory.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-6 w-6 mx-auto text-gray-400 mb-2" />
            <p className="text-xs">История изменений пуста</p>
          </div>
        ) : (
          displayHistory.map((entry, index) => {
            const IconComponent = changeTypeIcons[entry.changeType] || FileText;
            const isFirst = index === 0;
            
            return (
              <div key={entry.id} className="relative">
                
                <div className="flex items-start space-x-3 p-3 bg-white hover:bg-gray-50 rounded-lg transition-colors shadow-sm border border-gray-100">
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${changeTypeColors[entry.changeType]} flex-shrink-0`}>
                    <IconComponent className="h-3 w-3" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                        {changeTypeLabels[entry.changeType]}
                      </Badge>
                      <div className="text-xs text-gray-500 font-mono">
                        {format(new Date(entry.createdAt), 'dd.MM HH:mm', { locale: ru })}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-800 leading-relaxed">{entry.description}</p>
                    
                    {/* Show old/new values if available - hide technical status codes */}
                    {entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue && 
                     entry.changeType !== 'status_change' && (
                      <div className="flex items-center space-x-2 text-xs mt-2 p-2 bg-gray-50 rounded border">
                        <span className="text-red-600 font-medium truncate max-w-[100px]">{entry.oldValue}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600 font-medium truncate max-w-[100px]">{entry.newValue}</span>
                      </div>
                    )}
                    
                    {/* User info */}
                    {(entry.userFirstName || entry.userLastName) && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
                        <User className="h-3 w-3" />
                        <span>
                          {entry.userFirstName} {entry.userLastName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="hover:bg-blue-50">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к проекту
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">История проекта</h1>
                <p className="text-gray-600 mt-1">Все изменения и обновления проекта #{projectId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* History Timeline */}
        <div className="space-y-4">
          {history.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Clock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">История пуста</h3>
                  <p className="text-gray-500">Изменения в проекте будут отображаться здесь</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            history.map((entry, index) => {
              const IconComponent = changeTypeIcons[entry.changeType] || FileText;
              const isFirst = index === 0;
              
              return (
                <div key={entry.id} className="relative">
                  {/* Timeline line */}
                  {!isFirst && (
                    <div className="absolute left-6 -top-4 bottom-0 w-0.5 bg-gray-200"></div>
                  )}
                  
                  <Card className="ml-0">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        {/* Icon */}
                        <div className={`p-2 rounded-full ${changeTypeColors[entry.changeType]} flex-shrink-0`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className="text-xs">
                                {changeTypeLabels[entry.changeType]}
                              </Badge>
                              <div className="flex items-center text-sm text-gray-500">
                                <User className="h-3 w-3 mr-1" />
                                {entry.userFirstName && entry.userLastName 
                                  ? `${entry.userFirstName} ${entry.userLastName}`
                                  : entry.userEmail || 'Система'}
                              </div>
                            </div>
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(entry.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                            </div>
                          </div>
                          
                          <p className="text-gray-900 mb-2">{entry.description}</p>
                          
                          {/* Show old/new values if available - hide technical status codes */}
                          {entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue && 
                           entry.changeType !== 'status_change' && (
                            <div className="flex items-center space-x-4 text-sm bg-gray-50 p-3 rounded-lg">
                              <div className="flex-1">
                                <span className="text-gray-500">Было:</span>
                                <span className="ml-2 text-red-600 font-medium">{entry.oldValue}</span>
                              </div>
                              <div className="flex-1">
                                <span className="text-gray-500">Стало:</span>
                                <span className="ml-2 text-green-600 font-medium">{entry.newValue}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}