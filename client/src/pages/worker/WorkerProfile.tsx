import { useQuery } from '@tanstack/react-query';
import { WorkerLayout } from '@/components/Layout/WorkerLayout';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Users, MapPin, LogOut } from 'lucide-react';

interface WorkerProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  crewId: number;
  crew: {
    id: number;
    name: string;
    uniqueNumber: string;
  };
}

export default function WorkerProfile() {
  const { signOut, user } = useAuth();

  const { data: profile, isLoading } = useQuery<WorkerProfile>({
    queryKey: ['/api/worker/profile'],
    queryFn: async () => {
      const response = await apiRequest('/api/worker/profile', 'GET');
      return response.json();
    },
  });

  return (
    <WorkerLayout title="Profile">
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : profile ? (
          <>
            {/* Profile Avatar */}
            <div className="flex flex-col items-center py-6">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <User className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">
                {profile.firstName} {profile.lastName}
              </h2>
              <p className="text-gray-500">Worker</p>
            </div>

            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {profile.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <Mail className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <Phone className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <a href={`tel:${profile.phone}`} className="font-medium text-primary">
                        {profile.phone}
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Crew Info */}
            {profile.crew && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Crew Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Crew</p>
                      <p className="font-medium">{profile.crew.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xs text-gray-500 font-bold">#</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Crew Number</p>
                      <p className="font-medium">{profile.crew.uniqueNumber}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sign Out */}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={signOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>

            {/* App Info */}
            <div className="text-center pt-4 text-xs text-gray-400">
              <p>Worker Portal v1.0</p>
              <p>Project Management System</p>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-500">Failed to load profile</p>
              <Button onClick={signOut} variant="outline" className="mt-4">
                Sign Out
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </WorkerLayout>
  );
}
