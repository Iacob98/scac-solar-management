import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { MainLayout } from '@/components/Layout/MainLayout';
import { useEffect } from 'react';

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to projects page as the main dashboard
    setLocation('/projects');
  }, [setLocation]);

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          Willkommen, {user?.firstName} {user?.lastName}!
        </h1>
        <p className="text-gray-600 mt-2">
          Weiterleitung zum Projekt-Dashboard...
        </p>
      </div>
    </MainLayout>
  );
}
