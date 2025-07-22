import { useLocation, useParams, useSearch } from 'wouter';

// Enhanced routing utilities
export const useProjectParams = () => {
  const [location] = useLocation();
  const params = useParams();
  const search = useSearch();

  // Extract project ID from URL patterns like:
  // /projects/30 -> { projectId: 30 }
  // /projects?id=30 -> { projectId: 30 }
  const projectId = params.id || new URLSearchParams(search).get('id');

  return {
    projectId: projectId ? parseInt(projectId, 10) : null,
    location,
    params,
    search
  };
};

export const useRouteContext = () => {
  const [location] = useLocation();
  
  // Determine current route context
  const isProjectsRoute = location.startsWith('/projects');
  const isProjectDetailRoute = /^\/projects\/\d+/.test(location);
  const isClientsRoute = location.startsWith('/clients');
  const isCrewsRoute = location.startsWith('/crews');
  const isAdminRoute = location.startsWith('/admin');

  return {
    isProjectsRoute,
    isProjectDetailRoute,
    isClientsRoute,
    isCrewsRoute,
    isAdminRoute,
    currentPath: location
  };
};

// Navigation helpers
export const navigateToProject = (projectId: number) => `/projects/${projectId}`;
export const navigateToProjects = () => '/projects';
export const navigateToClients = () => '/clients';
export const navigateToCrews = () => '/crews';