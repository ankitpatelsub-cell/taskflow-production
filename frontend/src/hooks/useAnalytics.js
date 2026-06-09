import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// useCurrentWorkspaceId: the app does not yet have workspace-scoped state,
// so this stub returns null and analytics are fetched without a workspace filter.
// When workspace support is added, export this from useProjects and import it here.
function useCurrentWorkspaceId() {
  return null;
}

export function usePortfolioAnalytics() {
  const workspaceId = useCurrentWorkspaceId();
  return useQuery({
    queryKey: ['analytics', 'portfolio', workspaceId],
    queryFn: async () => {
      const { data } = await api.get('/analytics/portfolio', {
        params: workspaceId ? { workspace_id: workspaceId } : {},
      });
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useProjectHealth(projectId) {
  return useQuery({
    queryKey: ['analytics', 'health', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/projects/${projectId}/health`);
      return data;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}
