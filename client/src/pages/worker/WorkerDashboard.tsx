import { useQuery } from '@tanstack/react-query';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Calendar, MapPin, Clock, FolderOpen, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ReclamationBanner } from '@/components/Worker/ReclamationBanner';

interface Project {
  id: number;
  status: string;
  workStartDate: string | null;
  workEndDate: string | null;
  installationPersonFirstName: string | null;
  installationPersonLastName: string | null;
  installationPersonAddress: string | null;
  client: {
    name: string;
    address: string | null;
  };
}

const statusLabels: Record<string, { label: string; color: string }> = {
  planning: { label: 'Planning', color: 'bg-gray-100 text-gray-800' },
  equipment_waiting: { label: 'Waiting for Equipment', color: 'bg-yellow-100 text-yellow-800' },
  equipment_arrived: { label: 'Equipment Ready', color: 'bg-blue-100 text-blue-800' },
  work_scheduled: { label: 'Scheduled', color: 'bg-purple-100 text-purple-800' },
  work_in_progress: { label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  work_completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  invoiced: { label: 'Invoiced', color: 'bg-green-200 text-green-900' },
};

export default function WorkerDashboard() {
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['/api/worker/projects'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/projects', 'GET');
      return response.json();
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find today's projects
  const todayProjects = projects.filter((project) => {
    if (!project.workStartDate) return false;
    const startDate = new Date(project.workStartDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = project.workEndDate ? new Date(project.workEndDate) : startDate;
    endDate.setHours(23, 59, 59, 999);
    return today >= startDate && today <= endDate;
  });

  // Find upcoming projects (next 7 days)
  const upcomingProjects = projects.filter((project) => {
    if (!project.workStartDate) return false;
    const startDate = new Date(project.workStartDate);
    startDate.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return startDate > today && startDate <= weekFromNow;
  });

  // Active projects
  const activeProjects = projects.filter(
    (p) => p.status === 'work_in_progress' || p.status === 'work_scheduled'
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    return format(new Date(dateStr), 'd MMM', { locale: ru });
  };

  const getPersonName = (project: Project) => {
    const firstName = project.installationPersonFirstName || '';
    const lastName = project.installationPersonLastName || '';
    return [firstName, lastName].filter(Boolean).join(' ') || project.client?.name || 'Unknown';
  };

  return (
    <WorkerLayout title="Dashboard">
      <div className="p-4 space-y-6">
        {/* Reclamation Banner */}
        <ReclamationBanner />

        {/* Today's Work Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Today
            </h2>
            <span className="text-sm text-gray-500">
              {format(today, 'd MMMM yyyy', { locale: ru })}
            </span>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ) : todayProjects.length === 0 ? (
            <Card className="bg-gray-50 border-dashed">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">No projects scheduled for today</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todayProjects.map((project) => (
                <Link key={project.id} href={`/worker/projects/${project.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium">{getPersonName(project)}</h3>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="line-clamp-1">
                              {project.installationPersonAddress || project.client?.address || 'No address'}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            statusLabels[project.status]?.color || 'bg-gray-100'
                          }`}
                        >
                          {statusLabels[project.status]?.label || project.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Projects */}
        {upcomingProjects.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Upcoming
              </h2>
            </div>

            <div className="space-y-3">
              {upcomingProjects.slice(0, 3).map((project) => (
                <Link key={project.id} href={`/worker/projects/${project.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{getPersonName(project)}</h3>
                          <p className="text-sm text-gray-500">
                            {formatDate(project.workStartDate)}
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Quick Stats */}
        <section className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary">{activeProjects.length}</div>
              <p className="text-sm text-gray-500">Active Projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {projects.filter((p) => p.status === 'work_completed').length}
              </div>
              <p className="text-sm text-gray-500">Completed</p>
            </CardContent>
          </Card>
        </section>

        {/* View All Projects Link */}
        <div className="pt-4">
          <Link href="/worker/projects">
            <Button variant="outline" className="w-full">
              <FolderOpen className="w-4 h-4 mr-2" />
              View All Projects
            </Button>
          </Link>
        </div>
      </div>
    </WorkerLayout>
  );
}
