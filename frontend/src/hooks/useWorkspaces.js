import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export const workspaceKeys = {
  all: ['workspaces'],
  detail: (id) => ['workspaces', id],
  members: (id) => ['workspaces', id, 'members'],
};

export function useWorkspaces() {
  const { setWorkspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();
  const query = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: () => api.get('/workspaces').then((r) => r.data),
    staleTime: 30_000,
  });

  // React Query v5 removed onSuccess from useQuery; synchronise store via useEffect
  useEffect(() => {
    const data = query.data;
    if (!data) return;
    setWorkspaces(data);
    // Auto-select first workspace if none selected or current no longer exists
    if (data.length > 0 && (!currentWorkspaceId || !data.find((w) => w.id === currentWorkspaceId))) {
      setCurrentWorkspace(data[0].id);
    }
  }, [query.data]); // eslint-disable-line react-hooks/exhaustive-deps

  return query;
}

export function useWorkspace(id) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => api.get(`/workspaces/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useWorkspaceMembers(id) {
  return useQuery({
    queryKey: workspaceKeys.members(id),
    queryFn: () => api.get(`/workspaces/${id}/members`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const { setCurrentWorkspace, addWorkspace } = useWorkspaceStore();
  return useMutation({
    mutationFn: (data) => api.post('/workspaces', data).then((r) => r.data),
    onSuccess: (ws) => {
      addWorkspace(ws);
      setCurrentWorkspace(ws.id);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success(`Workspace "${ws.name}" created`);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create workspace'),
  });
}

export function useUpdateWorkspace(id) {
  return useMutation({
    mutationFn: (data) => api.patch(`/workspaces/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(id) });
      toast.success('Workspace updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update workspace'),
  });
}

export function useAddWorkspaceMember(workspaceId) {
  return useMutation({
    mutationFn: (data) => api.post(`/workspaces/${workspaceId}/members`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      toast.success('Member added to workspace');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add member'),
  });
}

export function useUpdateWorkspaceMemberRole(workspaceId) {
  return useMutation({
    mutationFn: ({ userId, role }) =>
      api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      toast.success('Role updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update role'),
  });
}

export function useRemoveWorkspaceMember(workspaceId) {
  return useMutation({
    mutationFn: (userId) =>
      api.delete(`/workspaces/${workspaceId}/members/${userId}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      toast.success('Member removed');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove member'),
  });
}
