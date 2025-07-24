import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { CalendarDays, Clock, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { MainLayout } from "@/components/Layout/MainLayout";

interface Crew {
  id: number;
  name: string;
  uniqueNumber: string;
  firmId: string;
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
    date.setMonth(date.getMonth() - 12);
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

  // Fetch crews list
  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ['/api/crews', selectedFirmId],
    queryFn: async () => {
      const response = await fetch(`/api/crews?firmId=${selectedFirmId}`);
      if (!response.ok) throw new Error('Failed to fetch crews');
      return response.json();
    },
    enabled: !!selectedFirmId,
  });

  // Fetch crew statistics
  const { data: statistics, isLoading: statisticsLoading, error: statisticsError } = useQuery<CrewStatistics>({
    queryKey: [`/api/crews/${selectedCrewId}/stats?from=${dateFrom}&to=${dateTo}`],
    enabled: !!selectedCrewId && !!dateFrom && !!dateTo,
  });

  // Fetch crew projects
  const { data: projects, isLoading: projectsLoading } = useQuery<CrewProjectsResponse>({
    queryKey: [`/api/crews/${selectedCrewId}/projects?from=${dateFrom}&to=${dateTo}&status=${projectStatus}&page=${currentPage}&size=20`],
    enabled: !!selectedCrewId && !!dateFrom && !!dateTo,
  });

  useEffect(() => {
    if (crews && crews.length > 0 && !selectedCrewId) {
      setSelectedCrewId(crews[0].id);
    }
  }, [crews, selectedCrewId]);

  const handleCrewChange = (crewId: string) => {
    setSelectedCrewId(parseInt(crewId));
    setCurrentPage(1);
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

  if (!crews || crews.length === 0) {
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crew-select">Бригада</Label>
              <Select
                value={selectedCrewId?.toString() || ""}
                onValueChange={handleCrewChange}
              >
                <SelectTrigger id="crew-select">
                  <SelectValue placeholder="Выберите бригаду" />
                </SelectTrigger>
                <SelectContent>
                  {crews?.map((crew: any) => (
                    <SelectItem key={crew.id} value={crew.id.toString()}>
                      {crew.name} ({crew.uniqueNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-from">Дата с</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">Дата по</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-filter">Статус проектов</Label>
              <Select
                value={projectStatus}
                onValueChange={setProjectStatus}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="completed">Завершенные</SelectItem>
                  <SelectItem value="work_in_progress">В процессе</SelectItem>
                  <SelectItem value="work_scheduled">Запланированные</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {selectedCrewId && (
        <>
          {statisticsError && (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-red-600">
                  Ошибка загрузки статистики: {statisticsError instanceof Error ? statisticsError.message : 'Неизвестная ошибка'}
                </div>
              </CardContent>
            </Card>
          )}

          {statisticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : statistics ? (
            <>
              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Завершенные объекты</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.metrics.completedObjects}</div>
                    <p className="text-xs text-muted-foreground">
                      За период {formatDate(statistics.period.from)} - {formatDate(statistics.period.to)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">В процессе</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.metrics.inProgress}</div>
                    <p className="text-xs text-muted-foreground">Активные проекты</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Средняя длительность</CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statistics.metrics.avgDurationDays}</div>
                    <p className="text-xs text-muted-foreground">дней</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Доля просроченных</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{Math.round(statistics.metrics.overdueShare * 100)}%</div>
                    <p className="text-xs text-muted-foreground">от общего числа</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Завершенные проекты по месяцам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={statistics.charts.completedByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Средняя длительность по месяцам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={statistics.charts.avgDurationByMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="days" stroke="#82ca9d" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {/* Projects Table */}
          <Card>
            <CardHeader>
              <CardTitle>Проекты бригады</CardTitle>
              <CardDescription>
                {projects?.total ? `Всего проектов: ${projects.total}` : 'Загрузка...'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    </div>
                  ))}
                </div>
              ) : projects?.items.length ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Проект</th>
                          <th className="text-left p-2">Статус</th>
                          <th className="text-left p-2">Клиент</th>
                          <th className="text-left p-2">Дата начала</th>
                          <th className="text-left p-2">Дата окончания</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.items.map((project) => (
                          <tr key={project.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-medium">{project.title}</td>
                            <td className="p-2">{getStatusBadge(project.status)}</td>
                            <td className="p-2">{project.installationPerson || '-'}</td>
                            <td className="p-2">{formatDate(project.workStartDate)}</td>
                            <td className="p-2">{formatDate(project.workEndDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {projects.total > 20 && (
                    <div className="flex items-center justify-between">
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
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Проекты не найдены для выбранного периода и фильтров
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
      </div>
    </MainLayout>
  );
}