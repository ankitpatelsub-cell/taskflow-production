import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export function useProjectStatuses(projectId) {
  return useQuery({
    queryKey: ['project-statuses', projectId],
    queryFn: () => api.get(`/projects/${projectId}/statuses`).then(r => r.data),
    enabled: !!projectId,
    staleTime: 60000,
  });
}

export function useCreateStatus(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/projects/${projectId}/statuses`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-statuses', projectId] }),
  });
}

export function useUpdateStatus(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => api.patch(`/projects/${projectId}/statuses/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-statuses', projectId] }),
  });
}

export function useDeleteStatus(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/projects/${projectId}/statuses/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-statuses', projectId] }),
  });
}

export function useReorderStatuses(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order) => api.post(`/projects/${projectId}/statuses/reorder`, { order }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-statuses', projectId] }),
  });
}
