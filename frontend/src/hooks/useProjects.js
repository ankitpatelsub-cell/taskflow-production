import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export const projectKeys = {
  all: (workspaceId) => ['projects', workspaceId],
  detail: (id) => ['projects', 'detail', id],
  members: (id) => ['projects', id, 'members'],
};

export function useProjects() {
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useQuery({
    queryKey: projectKeys.all(currentWorkspaceId),
    queryFn: () =>
      api.get('/projects', { params: currentWorkspaceId ? { workspace_id: currentWorkspaceId } : {} })
        .then((r) => r.data),
  });
}

export function useProject(id) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCurrentWorkspaceId() {
  return useWorkspaceStore((s) => s.currentWorkspaceId);
}

export function useProjectMembers(id) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => api.get(`/projects/${id}`).then((r) => r.data),
    enabled: !!id,
    select: (data) => data.members ?? [],
  });
}

export function useCreateProject() {
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: (data) =>
      api.post('/projects', { ...data, workspace_id: currentWorkspaceId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(currentWorkspaceId) });
      toast.success('Project created');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create project'),
  });
}

export function useUpdateProject(id) {
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  return useMutation({
    mutationFn: (data) => api.patch(`/projects/${id}`, data).then((r) => ({ ...r.data, _input: data })),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all(currentWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      if (vars.status === 'archived') toast.success('Project archived');
      else if (vars.status === 'active') toast.success('Project restored');
      else toast.success('Project updated');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update project'),
  });
}

export function useAddMember(projectId) {
  return useMutation({
    mutationFn: (userId) => api.post(`/projects/${projectId}/members`, { userId }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useRemoveMember(projectId) {
  return useMutation({
    mutationFn: (userId) => api.delete(`/projects/${projectId}/members/${userId}`).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}
