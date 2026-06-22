import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useTaskWatchers(taskId) {
  return useQuery({
    queryKey: ['watchers', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/watch`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useWatchTask(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tasks/${taskId}/watch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchers', taskId] }),
  });
}

export function useUnwatchTask(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/tasks/${taskId}/watch`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchers', taskId] }),
  });
}
