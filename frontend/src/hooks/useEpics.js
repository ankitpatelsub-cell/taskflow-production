import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';

export const epicKeys = {
  list: (projectId) => ['epics', projectId],
  detail: (projectId, epicId) => ['epics', projectId, epicId],
};

export function useEpics(projectId) {
  return useQuery({
    queryKey: epicKeys.list(projectId),
    queryFn: () =>
      api.get(`/projects/${projectId}/epics`).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useEpic(projectId, epicId) {
  return useQuery({
    queryKey: epicKeys.detail(projectId, epicId),
    queryFn: () =>
      api.get(`/projects/${projectId}/epics/${epicId}`).then((r) => r.data),
    enabled: !!projectId && !!epicId,
  });
}

export function useCreateEpic(projectId) {
  return useMutation({
    mutationFn: (data) =>
      api.post(`/projects/${projectId}/epics`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      toast.success('Epic created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create epic'),
  });
}

/**
 * Pass { epicId, ...data } to mutate() when epicId is not known at hook-call time,
 * or pre-bind epicId by passing it to the hook for single-epic edit flows.
 */
export function useUpdateEpic(projectId, epicId) {
  return useMutation({
    mutationFn: ({ epicId: dynId, ...data } = {}) => {
      const id = dynId ?? epicId;
      return api.patch(`/projects/${projectId}/epics/${id}`, data).then((r) => r.data);
    },
    onSuccess: (_, { epicId: dynId } = {}) => {
      const id = dynId ?? epicId;
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      if (id) queryClient.invalidateQueries({ queryKey: epicKeys.detail(projectId, id) });
      toast.success('Epic updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update epic'),
  });
}

export function useDeleteEpic(projectId) {
  return useMutation({
    mutationFn: (epicId) =>
      api.delete(`/projects/${projectId}/epics/${epicId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicKeys.list(projectId) });
      toast.success('Epic deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete epic'),
  });
}
