import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';

export const customFieldKeys = {
  list: (projectId) => ['custom-fields', projectId],
  values: (taskId) => ['custom-field-values', taskId],
};

export function useCustomFields(projectId) {
  return useQuery({
    queryKey: customFieldKeys.list(projectId),
    queryFn: () =>
      api.get(`/projects/${projectId}/custom-fields`).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useCreateCustomField(projectId) {
  return useMutation({
    mutationFn: (data) =>
      api.post(`/projects/${projectId}/custom-fields`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(projectId) });
      toast.success('Custom field created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create custom field'),
  });
}

export function useUpdateCustomField(projectId, fieldId) {
  return useMutation({
    mutationFn: (data) =>
      api.patch(`/projects/${projectId}/custom-fields/${fieldId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(projectId) });
      toast.success('Custom field updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update custom field'),
  });
}

export function useDeleteCustomField(projectId, fieldId) {
  return useMutation({
    mutationFn: () =>
      api.delete(`/projects/${projectId}/custom-fields/${fieldId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.list(projectId) });
      toast.success('Custom field deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete custom field'),
  });
}

export function useCustomFieldValues(taskId) {
  return useQuery({
    queryKey: customFieldKeys.values(taskId),
    queryFn: () =>
      api.get(`/tasks/${taskId}/custom-field-values`).then((r) => r.data),
    enabled: !!taskId,
  });
}

export function useUpsertCustomFieldValue(taskId, fieldId) {
  return useMutation({
    mutationFn: (value) =>
      api
        .put(`/tasks/${taskId}/custom-field-values/${fieldId}`, { value })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customFieldKeys.values(taskId) });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save value'),
  });
}
