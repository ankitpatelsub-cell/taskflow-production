import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';

export const sprintKeys = {
  list: (projectId) => ['sprints', projectId],
  detail: (projectId, sprintId) => ['sprints', projectId, sprintId],
  burndown: (projectId, sprintId) => ['sprints', projectId, sprintId, 'burndown'],
};

export function useSprints(projectId) {
  return useQuery({
    queryKey: sprintKeys.list(projectId),
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useSprint(projectId, sprintId) {
  return useQuery({
    queryKey: sprintKeys.detail(projectId, sprintId),
    queryFn: () =>
      api.get(`/projects/${projectId}/sprints/${sprintId}`).then((r) => r.data),
    enabled: !!projectId && !!sprintId,
  });
}

export function useSprintBurndown(projectId, sprintId) {
  return useQuery({
    queryKey: sprintKeys.burndown(projectId, sprintId),
    queryFn: () =>
      api.get(`/projects/${projectId}/sprints/${sprintId}/burndown`).then((r) => r.data),
    enabled: !!projectId && !!sprintId,
  });
}

export function useCreateSprint(projectId) {
  return useMutation({
    mutationFn: (data) =>
      api.post(`/projects/${projectId}/sprints`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success('Sprint created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create sprint'),
  });
}

export function useUpdateSprint(projectId, sprintId) {
  return useMutation({
    mutationFn: (data) =>
      api.patch(`/projects/${projectId}/sprints/${sprintId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) });
      toast.success('Sprint updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update sprint'),
  });
}

export function useDeleteSprint(projectId) {
  return useMutation({
    mutationFn: (sprintId) =>
      api.delete(`/projects/${projectId}/sprints/${sprintId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      toast.success('Sprint deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete sprint'),
  });
}

export function useStartSprint(projectId, sprintId) {
  return useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/sprints/${sprintId}/start`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) });
      toast.success('Sprint started');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to start sprint'),
  });
}

export function useCompleteSprint(projectId, sprintId) {
  return useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/sprints/${sprintId}/complete`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) });
      toast.success('Sprint completed');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to complete sprint'),
  });
}

export function useAddTaskToSprint(projectId, sprintId) {
  return useMutation({
    mutationFn: (taskId) =>
      api
        .post(`/projects/${projectId}/sprints/${sprintId}/tasks`, { taskId })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task added to sprint');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add task to sprint'),
  });
}

export function useRemoveTaskFromSprint(projectId, sprintId) {
  return useMutation({
    mutationFn: (taskId) =>
      api
        .delete(`/projects/${projectId}/sprints/${sprintId}/tasks/${taskId}`)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintKeys.detail(projectId, sprintId) });
      queryClient.invalidateQueries({ queryKey: sprintKeys.list(projectId) });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task removed from sprint');
    },
    onError: (err) =>
      toast.error(err.response?.data?.error || 'Failed to remove task from sprint'),
  });
}
