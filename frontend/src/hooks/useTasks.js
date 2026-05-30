import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

export const taskKeys = {
  list: (pid, filters) => ['tasks', pid, filters],
  detail: (pid, tid) => ['tasks', pid, tid],
};

export function useTasks(projectId, filters = {}) {
  return useQuery({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: () => api.get(`/projects/${projectId}/tasks`, { params: filters }).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useTask(projectId, taskId) {
  return useQuery({
    queryKey: taskKeys.detail(projectId, taskId),
    queryFn: () => api.get(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateTask(projectId) {
  return useMutation({
    mutationFn: (data) => api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}

export function useUpdateTask(projectId, taskId) {
  return useMutation({
    mutationFn: (data) => api.patch(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

export function useDeleteTask(projectId) {
  return useMutation({
    mutationFn: (taskId) => api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}

export function useMoveTask(projectId) {
  return useMutation({
    mutationFn: ({ taskId, status, position }) =>
      api.patch(`/projects/${projectId}/tasks/${taskId}/position`, { status, position }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}
