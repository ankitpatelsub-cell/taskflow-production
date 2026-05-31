import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';

export const taskKeys = {
  list: (pid, filters) => ['tasks', pid, filters],
  detail: (pid, tid) => ['tasks', pid, tid],
};

/**
 * Always returns an array of tasks for backward-compat with all consumers.
 * The raw paginated response is available via `query.data` before normalization
 * if you need it — but for most UI code just use the returned array.
 */
export function useTasks(projectId, filters = {}) {
  return useQuery({
    queryKey: taskKeys.list(projectId, filters),
    queryFn: async () => {
      const { data } = await api.get(`/projects/${projectId}/tasks`, { params: filters });
      // Backend returns { tasks: [...], pagination: {...} }
      // Normalize to always give a plain array so every component works
      return Array.isArray(data) ? data : (data?.tasks ?? []);
    },
    enabled: !!projectId,
  });
}

/**
 * Returns the full paginated response { tasks, pagination } when you need
 * page numbers, totals, etc.
 */
export function useTasksPaginated(projectId, filters = {}) {
  return useQuery({
    queryKey: [...taskKeys.list(projectId, filters), 'paginated'],
    queryFn: () =>
      api.get(`/projects/${projectId}/tasks`, { params: filters }).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useTask(projectId, taskId) {
  return useQuery({
    queryKey: taskKeys.detail(projectId, taskId),
    queryFn: () =>
      api.get(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
    enabled: !!projectId && !!taskId,
    retry: 1,
  });
}

export function useCreateTask(projectId) {
  return useMutation({
    mutationFn: (data) =>
      api.post(`/projects/${projectId}/tasks`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Task created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create task'),
  });
}

export function useUpdateTask(projectId, taskId) {
  return useMutation({
    mutationFn: (data) =>
      api.patch(`/projects/${projectId}/tasks/${taskId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(projectId, taskId) });
      toast.success('Task updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update task'),
  });
}

export function useDeleteTask(projectId) {
  return useMutation({
    mutationFn: (taskId) =>
      api.delete(`/projects/${projectId}/tasks/${taskId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Task deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete task'),
  });
}

export function useMoveTask(projectId) {
  return useMutation({
    mutationFn: ({ taskId, status, position }) =>
      api
        .patch(`/projects/${projectId}/tasks/${taskId}/position`, { status, position })
        .then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}
