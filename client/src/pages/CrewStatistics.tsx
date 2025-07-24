import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { CalendarDays, Clock, CheckCircle, AlertTriangle, ArrowLeft, Users, TrendingUp, Info, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/Layout/MainLayout";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Crew {
  id: number;
  name: string;
  uniqueNumber: string;
  firmId: string;
}

interface CrewSummary {
  id: number;
  name: string;
  uniqueNumber: string;
  projectsCount: number;
  completedProjects: number;
  overduePercentage: number;
  avgCompletionTime: number;
}

interface CrewsSummaryResponse {
  period: {
    from: string;
    to: string;
  };
  crews: CrewSummary[];
}

interface CrewStatistics {
  crewId: number;
  crewName: string;
  period: {
    from: string;
    to: string;
  };
  metrics: {
    completedObjects: number;
    inProgress: number;
    avgDurationDays: number;
    overdueShare: number;
  };
  charts: {
    completedByMonth: Array<{ month: string; count: number }>;
    avgDurationByMonth: Array<{ month: string; days: number }>;
  };
}

interface CrewProject {
  id: number;
  title: string;
  status: string;
  workStartDate?: string;
  workEndDate?: string;
  installationPerson?: string;
  createdAt: string;
}

interface CrewProjectsResponse {
  total: number;
  page: number;
  size: number;
  items: CrewProject[];
}

export default function CrewStatistics() {
  const [, setLocation] = useLocation();
  const [selectedCrewId, setSelectedCrewId] = useState<number | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [projectStatus, setProjectStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Get firm ID from localStorage
  useEffect(() => {
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
  }, []);

  // Fetch crews summary statistics
  const { data: crewsSummary, isLoading: summaryLoading } = useQuery<CrewsSummaryResponse>({
    queryKey: [`/api/crews/stats/summary?firmId=${selectedFirmId}&from=${dateFrom}&to=${dateTo}`],
    enabled: !!selectedFirmId && !!dateFrom && !!dateTo,
  });

  // Fetch detailed crew statistics (only when crew is selected)
  const { data: statistics, isLoading: statisticsLoading } = useQuery<CrewStatistics>({
    queryKey: [`/api/crews/${selectedCrewId}/stats?from=${dateFrom}&to=${dateTo}`],
    enabled: !!selectedCrewId && !!dateFrom && !!dateTo,
  });

  // Fetch crew projects (only when crew is selected)  
  const { data: projects, isLoading: projectsLoading } = useQuery<CrewProjectsResponse>({
    queryKey: [`/api/crews/${selectedCrewId}/projects?from=${dateFrom}&to=${dateTo}&status=${projectStatus}&page=${currentPage}&size=20`],
    enabled: !!selectedCrewId && !!dateFrom && !!dateTo,
  });

  const handleCrewSelect = (crewId: number) => {
    setSelectedCrewId(crewId);
    setCurrentPage(1);
  };

  const handleProjectClick = (projectId: number) => {
    setLocation(`/projects/${projectId}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
      'planning': { label: 'Планирование', variant: 'outline' },
      'work_scheduled': { label: 'Работа запланирована', variant: 'secondary' },
      'work_in_progress': { label: 'Работа в процессе', variant: 'default' },
      'work_completed': { label: 'Работа завершена', variant: 'secondary' },
      'invoiced': { label: 'Выставлен счет', variant: 'default' },
      'paid': { label: 'Оплачено', variant: 'secondary' },
    };

    const status_info = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={status_info.variant}>{status_info.label}</Badge>;
  };

  if (summaryLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Загрузка статистики бригад...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!crewsSummary || crewsSummary.crews.length === 0) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Бригады не найдены</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <TooltipProvider>
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/crews')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад к бригадам
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <h1 className="text-2xl font-bold">Статистика бригад</h1>
          </div>

          {/* Date Range Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Период анализа</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from">С даты</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">По дату</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Crews Statistics Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Обзор бригад ({crewsSummary.crews.length})
              </CardTitle>
              <CardDescription>
                Статистика за период с {formatDate(crewsSummary.period.from)} по {formatDate(crewsSummary.period.to)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {crewsSummary.crews.map((crew) => (
                  <Card key={crew.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="font-semibold text-lg">{crew.name}</h3>
                            <Badge variant="outline">№{crew.uniqueNumber}</Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <CalendarDays className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Всего проектов</p>
                                <p className="font-semibold">{crew.projectsCount}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">Завершено</p>
                                <p className="font-semibold">{crew.completedProjects}</p>
                              </div>
                            </div>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <div className="p-2 bg-red-100 rounded-lg">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      Доля просроченных
                                      <Info className="h-3 w-3" />
                                    </p>
                                    <p className="font-semibold">{(crew.overduePercentage * 100).toFixed(1)}%</p>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Процент проектов, которые завершились позже запланированной даты окончания работ</p>
                              </TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                  <div className="p-2 bg-yellow-100 rounded-lg">
                                    <Clock className="h-4 w-4 text-yellow-600" />
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      Средний срок
                                      <Info className="h-3 w-3" />
                                    </p>
                                    <p className="font-semibold">{crew.avgCompletionTime.toFixed(1)} дн.</p>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Среднее время выполнения проекта от начала до завершения работ (в днях)</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCrewSelect(crew.id)}
                            className="flex items-center gap-2"
                          >
                            <TrendingUp className="h-4 w-4" />
                            Подробная статистика
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Statistics for Selected Crew */}
          {selectedCrewId && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Подробная статистика</CardTitle>
                  <CardDescription>
                    {statistics ? `Бригада: ${statistics.crewName}` : 'Загрузка...'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {statisticsLoading ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Загрузка подробной статистики...</p>
                    </div>
                  ) : !statistics ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Ошибка загрузки статистики</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                          <CardContent className="p-4 text-center">
                            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-green-600">{statistics.metrics.completedObjects}</p>
                            <p className="text-sm text-muted-foreground">Завершённых объектов</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-4 text-center">
                            <Clock className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-blue-600">{statistics.metrics.inProgress}</p>
                            <p className="text-sm text-muted-foreground">В процессе</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-4 text-center">
                            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-red-600">{(statistics.metrics.overdueShare * 100).toFixed(1)}%</p>
                            <p className="text-sm text-muted-foreground">Доля просроченных</p>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardContent className="p-4 text-center">
                            <CalendarDays className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-purple-600">{statistics.metrics.avgDurationDays.toFixed(1)}</p>
                            <p className="text-sm text-muted-foreground">Средний срок (дни)</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Charts */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader>
                            <CardTitle>Завершённые проекты по месяцам</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <BarChart data={statistics.charts.completedByMonth}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <RechartsTooltip />
                                <Bar dataKey="count" fill="#22c55e" />
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Средняя продолжительность по месяцам</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={statistics.charts.avgDurationByMonth}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis />
                                <RechartsTooltip />
                                <Line type="monotone" dataKey="days" stroke="#3b82f6" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Projects List */}
              <Card>
                <CardHeader>
                  <CardTitle>Проекты бригады</CardTitle>
                  <CardDescription>
                    Список проектов за выбранный период
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Select value={projectStatus} onValueChange={setProjectStatus}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Статус проекта" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Все статусы</SelectItem>
                          <SelectItem value="planning">Планирование</SelectItem>
                          <SelectItem value="work_scheduled">Работа запланирована</SelectItem>
                          <SelectItem value="work_in_progress">Работа в процессе</SelectItem>
                          <SelectItem value="work_completed">Работа завершена</SelectItem>
                          <SelectItem value="invoiced">Выставлен счет</SelectItem>
                          <SelectItem value="paid">Оплачено</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {projectsLoading ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Загрузка проектов...</p>
                      </div>
                    ) : !projects ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">Ошибка загрузки проектов</p>
                      </div>
                    ) : projects.items.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Проекты не найдены для выбранного периода и фильтров
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          {projects.items.map((project) => (
                            <Card 
                              key={project.id} 
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleProjectClick(project.id)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <h4 className="font-semibold">{project.title}</h4>
                                      {getStatusBadge(project.status)}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                                      <div>
                                        <p>Клиент: {project.installationPerson || 'Не указан'}</p>
                                      </div>
                                      <div>
                                        <p>Начало работ: {formatDate(project.workStartDate)}</p>
                                      </div>
                                      <div>
                                        <p>Окончание работ: {formatDate(project.workEndDate)}</p>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleProjectClick(project.id);
                                      }}
                                      className="flex items-center gap-2"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Открыть проект
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        {/* Pagination */}
                        {projects.total > 20 && (
                          <div className="flex items-center justify-between pt-4">
                            <p className="text-sm text-muted-foreground">
                              Показано {Math.min(currentPage * 20, projects.total)} из {projects.total} проектов
                            </p>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(currentPage - 1)}
                              >
                                Предыдущая
                              </Button>
                              <span className="text-sm">
                                Страница {currentPage} из {Math.ceil(projects.total / 20)}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={currentPage >= Math.ceil(projects.total / 20)}
                                onClick={() => setCurrentPage(currentPage + 1)}
                              >
                                Следующая
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </TooltipProvider>
    </MainLayout>
  );
}