import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useProject, useAddMember, useRemoveMember } from '@/hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuthStore } from '@/stores/authStore';
import { Trash2 } from 'lucide-react';
import { ProjectNav } from './ProjectNav';

export function MembersPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { user } = useAuthStore();
  const addMember = useAddMember(projectId);
  const removeMember = useRemoveMember(projectId);
  const [selectedUser, setSelectedUser] = useState('');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
    enabled: user?.role === 'admin',
  });

  const memberIds = new Set(project?.members?.map((m) => m.id) || []);
  const nonMembers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 max-w-2xl mx-auto w-full">
        <h3 className="font-semibold text-gray-800 mb-4">Project Members ({project?.members?.length || 0})</h3>

        {user?.role === 'admin' && nonMembers.length > 0 && (
          <div className="flex gap-2 mb-4">
            <Select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="flex-1">
              <option value="">Select user to add…</option>
              {nonMembers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </Select>
            <Button
              onClick={() => addMember.mutate(selectedUser, { onSuccess: () => setSelectedUser('') })}
              disabled={!selectedUser || addMember.isPending}
            >
              Add
            </Button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {project?.members?.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={m.name} src={m.avatar_url} />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{m.role}</span>
              {user?.role === 'admin' && m.id !== user.id && (
                <button
                  onClick={() => removeMember.mutate(m.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
