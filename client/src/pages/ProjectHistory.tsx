import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, User, FileText, AlertCircle, Calendar, Package, Phone, Users } from 'lucide-react';

interface ProjectHistoryEntry {
  id: number;
  projectId: number;
  userId: string;
  changeType: 'status_change' | 'date_update' | 'info_update' | 'created' | 'equipment_update' | 'call_update' | 'assignment_change';
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
};

const changeTypeColors = {
  'status_change': 'bg-blue-100 text-blue-700',
  'date_update': 'bg-green-100 text-green-700',
  'info_update': 'bg-gray-100 text-gray-700',
  'created': 'bg-purple-100 text-purple-700',
  'equipment_update': 'bg-orange-100 text-orange-700',
  'call_update': 'bg-red-100 text-red-700',
  'assignment_change': 'bg-yellow-100 text-yellow-700',
};

const changeTypeLabels = {
  'status_change': 'Изменение статуса',
  'date_update': 'Изменение даты',
  'info_update': 'Обновление информации',
  'created': 'Создание',
  'equipment_update': 'Оборудование',
  'call_update': 'Звонок клиенту',
  'assignment_change': 'Назначение команды',
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
      <div className="space-y-3">
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
                {/* Timeline line */}
                {!isFirst && (
                  <div className="absolute left-4 -top-4 bottom-0 w-0.5 bg-gray-200"></div>
                )}
                
                <div className="flex items-start space-x-2 p-2 hover:bg-gray-50 rounded-md transition-colors">
                  {/* Icon */}
                  <div className={`p-1 rounded-full ${changeTypeColors[entry.changeType]} flex-shrink-0`}>
                    <IconComponent className="h-2.5 w-2.5" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        {changeTypeLabels[entry.changeType]}
                      </Badge>
                      <div className="text-xs text-gray-400">
                        {format(new Date(entry.createdAt), 'dd.MM HH:mm', { locale: ru })}
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-700 mt-1 line-clamp-2">{entry.description}</p>
                    
                    {/* Show old/new values if available */}
                    {entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue && (
                      <div className="flex items-center space-x-1 text-xs mt-1">
                        <span className="text-red-500 truncate max-w-[80px]">{entry.oldValue}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-green-500 truncate max-w-[80px]">{entry.newValue}</span>
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
                          
                          {/* Show old/new values if available */}
                          {entry.oldValue && entry.newValue && entry.oldValue !== entry.newValue && (
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