import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/queryClient';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Clock, User, FileText, AlertCircle, Calendar, Package, Phone, Users, Upload, Trash2, Star, Share2, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface ProjectHistoryEntry {
  id: number;
  projectId: number;
  userId: string;
  changeType: 'status_change' | 'date_update' | 'info_update' | 'created' | 'equipment_update' | 'call_update' | 'assignment_change' | 'shared' | 'file_added' | 'file_deleted' | 'report_added' | 'report_updated' | 'report_deleted' | 'note_added';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description: string;
  crewSnapshotId?: number;
  createdAt: string;
  userFirstName?: string;
  userLastName?: string;
  userEmail?: string;
  notePriority?: 'normal' | 'important' | 'urgent' | 'critical' | null;
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
  'note_added': MessageSquare,
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
  'note_added': 'bg-blue-100 text-blue-700',
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
  'note_added': 'Примечание добавлено',
  'crew_assigned': 'Бригада назначена',
  'crew_snapshot_created': 'Снимок бригады',
};

// Функция для определения приоритета из описания примечания (для обратной совместимости со старыми записями)
const extractNotePriority = (description: string): 'normal' | 'important' | 'urgent' | 'critical' => {
  if (description.includes('(Важное)')) return 'important';
  if (description.includes('(Срочное)')) return 'urgent';
  if (description.includes('(Критическое)')) return 'critical';
  return 'normal';
};

// Функция для очистки описания от приоритета в скобках
const cleanDescription = (description: string): string => {
  return description
    .replace(' (Важное)', '')
    .replace(' (Срочное)', '')
    .replace(' (Критическое)', '');
};

// Цвета для приоритетов примечаний
const priorityStyles = {
  normal: 'bg-white border-gray-200',
  important: 'bg-blue-50 border-blue-200',
  urgent: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200',
};

const priorityBadgeStyles = {
  normal: '',
  important: 'bg-blue-100 text-blue-700 border-blue-300',
  urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  critical: 'bg-red-100 text-red-700 border-red-300',
};

export default function ProjectHistory({ projectId, onBack, embedded = false, limit }: ProjectHistoryProps) {
  const [selectedSnapshot, setSelectedSnapshot] = useState<number | null>(null);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  
  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'history'],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/projects/${projectId}/history`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch project history');
      }
      return response.json();
    },
    refetchInterval: 5000, // Автообновление каждые 5 секунд
  });

  // Получаем данные проекта для получения firmId
  const { data: project } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/projects/${projectId}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      return response.json();
    },
  });

  // Получаем список бригад для отображения их названий
  const { data: crews = [] } = useQuery({
    queryKey: ['/api/crews', project?.firmId],
    enabled: !!project?.firmId,
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/crews?firmId=${project.firmId}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch crews');
      }
      return response.json();
    },
  });
  
  // Fetch snapshot data when selected
  const { isLoading: snapshotLoading } = useQuery({
    queryKey: ['/api/crew-snapshots', selectedSnapshot],
    enabled: !!selectedSnapshot,
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/crew-snapshots/${selectedSnapshot}`, {
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error('Failed to fetch crew snapshot');
      }
      const data = await response.json();
      setSnapshotData(data);
      return data;
    },
  });

  // Функция для форматирования описания с названием бригады
  const formatDescription = (entry: ProjectHistoryEntry): React.ReactNode => {
    // Обрабатываем записи о назначении бригады (как fieldName 'crewId', так и 'crew')
    if (entry.changeType === 'assignment_change' && (entry.fieldName === 'crewId' || entry.fieldName === 'crew')) {
      
      // Если fieldName === 'crewId', используем старую логику
      if (entry.fieldName === 'crewId') {
        const crewId = entry.newValue ? parseInt(entry.newValue) : null;
        const crew = crewId ? crews.find((c: any) => c.id === crewId) : null;
        
        if (crewId && crew) {
          return (
            <span>
              Команда{' '}
              {entry.crewSnapshotId ? (
                <button
                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Crew click:', { crewSnapshotId: entry.crewSnapshotId, entry });
                    if (entry.crewSnapshotId) {
                      console.log('Setting selectedSnapshot to:', entry.crewSnapshotId);
                      setSelectedSnapshot(entry.crewSnapshotId);
                    }
                  }}
                >
                  "{crew.name}"
                </button>
              ) : (
                <span className="font-semibold">"{crew.name}"</span>
              )}
              {' '}назначена
              {entry.crewSnapshotId && ' (снимок сохранен)'}
            </span>
          );
        } else if (!crewId) {
          return 'Команда снята с проекта';
        }
      }
      
      // Если fieldName === 'crew', парсим название бригады из описания
      if (entry.fieldName === 'crew') {
        const description = entry.description;
        const brigadeNameMatch = description.match(/Бригада\s+"([^"]+)"/);
        
        if (brigadeNameMatch && entry.crewSnapshotId) {
          const brigadeName = brigadeNameMatch[1];
          const participantsMatch = description.match(/\(участники:\s*([^)]+)\)/);
          const participants = participantsMatch ? participantsMatch[1] : '';
          
          return (
            <span>
              Бригада{' '}
              <button
                className="text-blue-600 hover:text-blue-800 font-semibold underline"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Crew click:', { crewSnapshotId: entry.crewSnapshotId, entry });
                  if (entry.crewSnapshotId) {
                    console.log('Setting selectedSnapshot to:', entry.crewSnapshotId);
                    setSelectedSnapshot(entry.crewSnapshotId);
                  }
                }}
              >
                "{brigadeName}"
              </button>
              {' '}назначена
              {participants && (
                <span className="text-gray-600"> (участники: {participants})</span>
              )}
            </span>
          );
        }
      }
    }
    
    return cleanDescription(entry.description);
  };

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
      <>
      <div className="space-y-2">
        {displayHistory.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-6 w-6 mx-auto text-gray-400 mb-2" />
            <p className="text-xs">История изменений пуста</p>
          </div>
        ) : (
          displayHistory.map((entry: ProjectHistoryEntry, index: number) => {
            const IconComponent = changeTypeIcons[entry.changeType] || FileText;
            const isFirst = index === 0;
            // Используем приоритет из API или извлекаем из описания для старых записей
            const priority = entry.changeType === 'note_added' ? 
              (entry.notePriority || extractNotePriority(entry.description)) : 'normal' as 'normal' | 'important' | 'urgent' | 'critical';
            const cardStyle = entry.changeType === 'note_added' ? priorityStyles[priority] : 'bg-white border-gray-200';
            
            return (
              <div key={entry.id} className="relative">
                
                <div 
                  className={`flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors shadow-sm border ${cardStyle}`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-full ${changeTypeColors[entry.changeType]} flex-shrink-0`}>
                    <IconComponent className="h-3 w-3" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium">
                          {changeTypeLabels[entry.changeType]}
                        </Badge>
                        {/* Показываем приоритет только для примечаний и если он не normal */}
                        {entry.changeType === 'note_added' && priority !== 'normal' && (
                          <Badge className={`text-xs px-2 py-0.5 font-medium border ${priorityBadgeStyles[priority]}`}>
                            {priority === 'important' ? 'Важное' : 
                             priority === 'urgent' ? 'Срочное' : 
                             priority === 'critical' ? 'Критическое' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {format(new Date(entry.createdAt), 'dd.MM HH:mm', { locale: ru })}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-800 leading-relaxed">{formatDescription(entry)}</p>
                    
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

      {/* Crew Snapshot Dialog */}
      <Dialog open={!!selectedSnapshot} onOpenChange={() => {
        setSelectedSnapshot(null);
        setSnapshotData(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Снимок состава бригады</DialogTitle>
            <DialogDescription>
              Состав бригады на момент назначения на проект
            </DialogDescription>
          </DialogHeader>
          
          {snapshotLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : snapshotData ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">
                  {snapshotData.crewData?.name} ({snapshotData.crewData?.uniqueNumber})
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Руководитель:</span>
                    <span className="ml-2">{snapshotData.crewData?.leaderName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Телефон:</span>
                    <span className="ml-2">{snapshotData.crewData?.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Адрес:</span>
                    <span className="ml-2">{snapshotData.crewData?.address}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Дата снимка:</span>
                    <span className="ml-2">
                      {format(new Date(snapshotData.snapshotDate), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                </div>
              </div>
              
              {snapshotData.membersData && snapshotData.membersData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Участники бригады ({snapshotData.membersData.length})</h4>
                  <div className="space-y-2">
                    {snapshotData.membersData.map((member: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{member.firstName} {member.lastName}</p>
                            <p className="text-sm text-gray-600">{member.position}</p>
                          </div>
                          <div className="text-sm text-gray-500 text-right">
                            {member.phone && <p>{member.phone}</p>}
                            {member.email && <p>{member.email}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500">Не удалось загрузить данные снимка</p>
          )}
        </DialogContent>
      </Dialog>
      </>
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
            history.map((entry: ProjectHistoryEntry, index: number) => {
              const IconComponent = changeTypeIcons[entry.changeType] || FileText;
              const isFirst = index === 0;
              // Используем приоритет из API или извлекаем из описания для старых записей
              const priority = entry.changeType === 'note_added' ? 
                (entry.notePriority || extractNotePriority(entry.description)) : 'normal' as 'normal' | 'important' | 'urgent' | 'critical';
              const cardBgStyle = entry.changeType === 'note_added' && priority !== 'normal' ? 
                `${priority === 'important' ? 'bg-blue-50 border-blue-200' : 
                  priority === 'urgent' ? 'bg-orange-50 border-orange-200' : 
                  priority === 'critical' ? 'bg-red-50 border-red-200' : ''}` : '';
              
              return (
                <div key={entry.id} className="relative">
                  {/* Timeline line */}
                  {!isFirst && (
                    <div className="absolute left-6 -top-4 bottom-0 w-0.5 bg-gray-200"></div>
                  )}
                  
                  <Card 
                    className={`ml-0 ${cardBgStyle}`}
                  >
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
                              {/* Показываем приоритет только для примечаний и если он не normal */}
                              {entry.changeType === 'note_added' && priority !== 'normal' && (
                                <Badge className={`text-xs px-2 py-0.5 font-medium border ${priorityBadgeStyles[priority]}`}>
                                  {priority === 'important' ? 'Важное' : 
                                   priority === 'urgent' ? 'Срочное' : 
                                   priority === 'critical' ? 'Критическое' : ''}
                                </Badge>
                              )}
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
                          
                          <p className="text-gray-900 mb-2">{formatDescription(entry)}</p>
                          
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

      {/* Crew Snapshot Dialog */}
      <Dialog open={!!selectedSnapshot} onOpenChange={() => {
        setSelectedSnapshot(null);
        setSnapshotData(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Снимок состава бригады</DialogTitle>
            <DialogDescription>
              Состав бригады на момент назначения на проект
            </DialogDescription>
          </DialogHeader>
          
          {snapshotLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : snapshotData ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">
                  {snapshotData.crewData?.name} ({snapshotData.crewData?.uniqueNumber})
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Руководитель:</span>
                    <span className="ml-2">{snapshotData.crewData?.leaderName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Телефон:</span>
                    <span className="ml-2">{snapshotData.crewData?.phone}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Адрес:</span>
                    <span className="ml-2">{snapshotData.crewData?.address}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Дата снимка:</span>
                    <span className="ml-2">
                      {format(new Date(snapshotData.snapshotDate), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                </div>
              </div>
              
              {snapshotData.membersData && snapshotData.membersData.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Участники бригады:</h4>
                  <div className="space-y-2">
                    {snapshotData.membersData.map((member: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-gray-500">{member.position}</p>
                          </div>
                          <div className="text-sm">
                            <p className="text-gray-600">{member.phone}</p>
                            {member.email && (
                              <p className="text-gray-600">{member.email}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Данные снимка не найдены</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}