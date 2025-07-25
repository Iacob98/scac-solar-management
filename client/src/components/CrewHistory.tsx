import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserPlus, UserMinus, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
// import { ru } from 'date-fns/locale';

interface CrewHistoryEntry {
  id: number;
  crewId: number;
  changeType: 'crew_created' | 'member_added' | 'member_removed';
  memberId?: number;
  memberName?: string;
  memberSpecialization?: string;
  memberGoogleCalendarId?: string;
  startDate?: string;
  endDate?: string;
  changeDescription: string;
  createdAt: string;
  createdBy?: string;
}

interface CrewHistoryProps {
  crewId: number;
  crewName: string;
}

export function CrewHistory({ crewId, crewName }: CrewHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Всегда раскрыта, так как используется внутри карточки

  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ['crew-history', crewId],
    queryFn: async () => {
      const response = await fetch(`/api/crews/${crewId}/history`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить историю бригады');
      }
      return response.json() as CrewHistoryEntry[];
    },
    enabled: true, // Всегда загружаем данные
  });

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'crew_created':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'member_added':
        return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'member_removed':
        return <UserMinus className="h-4 w-4 text-red-500" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChangeTypeLabel = (changeType: string) => {
    switch (changeType) {
      case 'crew_created':
        return 'Создание бригады';
      case 'member_added':
        return 'Добавлен участник';
      case 'member_removed':
        return 'Исключен участник';
      default:
        return changeType;
    }
  };

  const getChangeTypeBadgeColor = (changeType: string) => {
    switch (changeType) {
      case 'crew_created':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'member_added':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'member_removed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">
          История изменения состава
        </h4>
      </div>

        {isLoading ? (
            <div className="flex justify-center py-4 sm:py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <div className="text-center py-4 sm:py-8 text-red-600 text-sm">
              Ошибка загрузки истории изменений
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-4 sm:py-8 text-gray-500 text-sm">
              История изменений пуста
            </div>
          ) : (
            <ScrollArea className="h-48 sm:h-96">
              <div className="space-y-3 sm:space-y-4">
                {history.map((entry, index) => (
                  <div key={entry.id}>
                    <div className="flex items-start space-x-2 sm:space-x-3">
                      <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                        {getChangeIcon(entry.changeType)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1 gap-1 sm:gap-0">
                          <Badge className={`${getChangeTypeBadgeColor(entry.changeType)} text-xs`}>
                            {getChangeTypeLabel(entry.changeType)}
                          </Badge>
                          
                          <span className="text-xs sm:text-sm text-gray-500">
                            {format(new Date(entry.createdAt), 'dd.MM.yyyy HH:mm')}
                          </span>
                        </div>
                        
                        <div className="text-xs sm:text-sm text-gray-900 dark:text-gray-100 mb-2">
                          {entry.changeDescription}
                        </div>
                        
                        {(entry.memberName || entry.memberSpecialization) && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {entry.memberName && (
                              <div className="truncate">Участник: {entry.memberName}</div>
                            )}
                            {entry.memberSpecialization && (
                              <div className="truncate">Специализация: {entry.memberSpecialization}</div>
                            )}
                            {entry.startDate && (
                              <div className="text-xs">
                                <div>Период работы:</div> 
                                <div className="pl-2">
                                  {entry.startDate}
                                  {entry.endDate && ` - ${entry.endDate}`}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {index < history.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
    </div>
  );
}