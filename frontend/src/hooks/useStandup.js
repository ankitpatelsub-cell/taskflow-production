import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useStandup(projectId, params = {}) {
  return useQuery({
    queryKey: ['standup', projectId, params],
    queryFn: () => api.get(`/projects/${projectId}/standup`, { params }).then((r) => r.data),
    enabled: !!projectId,
  });
}
