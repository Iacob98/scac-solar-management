import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, MapPin, Clock, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/Layout/MainLayout';
import { useAuth } from '@/hooks/useAuth';
// Using selectedFirmId from TopHeader component pattern
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Project, Crew } from '@shared/schema';

function CalendarTest() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const selectedFirm = localStorage.getItem('selectedFirmId') || '';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получаем проекты
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!selectedFirm,
  });

  // Получаем бригады
  const { data: crews = [], isLoading: crewsLoading } = useQuery<Crew[]>({
    queryKey: ['/api/crews'],
    enabled: !!selectedFirm,
  });

  // Получаем участников выбранной бригады
  const { data: crewMembers = [] } = useQuery({
    queryKey: [`/api/crew-members?crewId=${selectedCrew}`],
    enabled: !!selectedCrew,
  });

  // Мутация для создания тестовых календарных событий
  const createCalendarEventsMutation = useMutation({
    mutationFn: async ({ projectId, crewId }: { projectId: number; crewId: number }) => {
      return apiRequest(`/api/calendar-demo/create-demo-events/${projectId}/${crewId}`, {
        method: 'POST'
      });
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: "Успешно",
        description: data.message,
        variant: "default"
      });
    },
    onError: (error) => {
      console.error('Error creating calendar events:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось создать календарные события",
        variant: "destructive"
      });
    }
  });

  const handleTestCalendar = () => {
    if (!selectedProject || !selectedCrew) {
      toast({
        title: "Ошибка",
        description: "Выберите проект и бригаду для тестирования",
        variant: "destructive"
      });
      return;
    }

    createCalendarEventsMutation.mutate({
      projectId: selectedProject,
      crewId: selectedCrew
    });
  };

  const selectedProjectData = projects.find(p => p.id === selectedProject);
  const selectedCrewData = crews.find(c => c.id === selectedCrew);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Тест Google Calendar</h1>
            <p className="text-gray-600 mt-2">
              Демонстрация автоматического создания календарных событий для участников бригады
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Выбор проекта и бригады */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Настройка теста
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Выберите проект</label>
                <Select 
                  value={selectedProject?.toString() || ""} 
                  onValueChange={(value) => setSelectedProject(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите проект..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        Проект #{project.id} - {project.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Выберите бригаду</label>
                <Select 
                  value={selectedCrew?.toString() || ""} 
                  onValueChange={(value) => setSelectedCrew(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите бригаду..." />
                  </SelectTrigger>
                  <SelectContent>
                    {crews.map((crew) => (
                      <SelectItem key={crew.id} value={crew.id.toString()}>
                        {crew.name} ({crew.leaderName})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleTestCalendar}
                disabled={!selectedProject || !selectedCrew || createCalendarEventsMutation.isPending}
                className="w-full"
              >
                {createCalendarEventsMutation.isPending ? "Создание событий..." : "Создать календарные события"}
              </Button>
            </CardContent>
          </Card>

          {/* Информация о выбранных элементах */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Участники бригады
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCrew ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedCrewData?.name}</Badge>
                    <span className="text-sm text-gray-600">
                      Руководитель: {selectedCrewData?.leaderName}
                    </span>
                  </div>
                  
                  {crewMembers.length > 0 ? (
                    <div className="space-y-2">
                      {crewMembers.map((member: any) => (
                        <div key={member.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div>
                            <p className="font-medium">{member.firstName} {member.lastName}</p>
                            <p className="text-xs text-gray-500">{member.role}</p>
                          </div>
                          <div className="text-right">
                            {member.memberEmail ? (
                              <div>
                                <Badge variant="default" className="text-xs mb-1">
                                  {member.memberEmail}
                                </Badge>
                                {member.googleCalendarId && (
                                  <div className="text-xs text-gray-500">
                                    📅 {member.googleCalendarId}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Нет email
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      Участники не найдены
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  Выберите бригаду для просмотра участников
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Результат теста */}
        {testResult && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-5 w-5" />
                Результат создания календарных событий
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">{testResult.message}</Badge>
                </div>
                
                {testResult.events && testResult.events.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Созданные события:</h4>
                    {testResult.events.map((event: any, index: number) => (
                      <div key={index} className="p-3 bg-white dark:bg-gray-900 rounded-md border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span className="font-medium">{event.memberName}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {event.googleCalendarId}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            <span>{event.event.summary}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>{event.event.location}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>{event.event.startDate} - {event.event.endDate}</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                          <strong>Описание события:</strong>
                          <pre className="whitespace-pre-wrap">{event.event.description}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Информационная карточка */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="text-blue-700 dark:text-blue-300">
              Как работает Google Calendar интеграция
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
              <p>При назначении бригады на проект автоматически создаются календарные события</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
              <p>События создаются для всех участников бригады с указанным Google Calendar ID</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</div>
              <p>В событии указывается информация о проекте, клиенте, адресе установки и датах</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</div>
              <p>Участники получают уведомления в своих календарях Google автоматически</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

export default CalendarTest;