import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { MainLayout } from '@/components/Layout/MainLayout';
import { FilterPanel } from '@/components/Projects/FilterPanel';
import { ProjectsTable } from '@/components/Projects/ProjectsTable';
import { ProjectWizard } from '@/components/Projects/ProjectWizard';
import { StatsCards } from '@/components/Projects/StatsCards';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Projects() {
  const { t } = useI18n();
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [filters, setFilters] = useState({
    clientId: 'all',
    status: 'all',
    crewId: 'all',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    // Get selected firm from localStorage  
    const firmId = localStorage.getItem('selectedFirmId');
    if (firmId) {
      setSelectedFirmId(firmId);
    }
    
    // Listen for storage changes to update when firm selection changes
    const handleStorageChange = () => {
      const newFirmId = localStorage.getItem('selectedFirmId');
      if (newFirmId && newFirmId !== selectedFirmId) {
        setSelectedFirmId(newFirmId);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [selectedFirmId]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!selectedFirmId) {
    return (
      <MainLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            {t('projectsTitle')}
          </h1>
          <p className="text-gray-600">
            Bitte wählen Sie eine Firma aus dem Header aus, um Projekte zu verwalten.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {/* Page Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{t('projectsTitle')}</h1>
            <p className="text-gray-600 mt-1">{t('projectsDescription')}</p>
          </div>
          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-primary hover:bg-primary-dark text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('newProject')}
          </Button>
        </div>

        <FilterPanel 
          firmId={selectedFirmId} 
          filters={filters} 
          onFilterChange={handleFilterChange} 
        />
      </div>

      {/* Projects Table */}
      <div className="p-6">
        <ProjectsTable firmId={selectedFirmId} filters={filters} />
      </div>

      {/* Stats Cards */}
      <div className="px-6 pb-6">
        <StatsCards firmId={selectedFirmId} />
      </div>

      {/* Project Wizard */}
      <ProjectWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        firmId={selectedFirmId} 
      />
    </MainLayout>
  );
}
