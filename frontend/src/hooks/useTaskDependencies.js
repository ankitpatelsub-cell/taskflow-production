import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useTaskDependencies(taskId) {
  return useQuery({
    queryKey: ['dependencies', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/dependencies`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useAddDependency(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depends_on) => api.post(`/tasks/${taskId}/dependencies`, { depends_on }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dependencies', taskId] }),
  });
}

export function useRemoveDependency(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId) => api.delete(`/tasks/${taskId}/dependencies/${depId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dependencies', taskId] }),
  });
}
