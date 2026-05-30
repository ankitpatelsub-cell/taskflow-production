import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import { Plus, UserX, Key } from 'lucide-react';

export function UserManagementPage() {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);

  const create = useMutation({
    mutationFn: (d) => api.post('/users', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/users/${id}`, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const resetPw = useMutation({
    mutationFn: ({ id, password }) => api.patch(`/users/${id}/password`, { password }),
    onSuccess: () => setResetUserId(null),
  });

  const { register: regCreate, handleSubmit: hsCreate, reset: resetCreate } = useForm();
  const { register: regReset, handleSubmit: hsReset } = useForm();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500">{users.length} users in workspace</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus size={16} />Add User</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} src={u.avatar_url} />
                    <div>
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggle.mutate({ id: u.id, is_active: u.is_active ? 0 : 1 })}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded"
                      title={u.is_active ? 'Deactivate' : 'Activate'}
                    >
                      <UserX size={15} />
                    </button>
                    <button
                      onClick={() => setResetUserId(u.id)}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 rounded"
                      title="Reset password"
                    >
                      <Key size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create User">
          <form onSubmit={hsCreate((d) => create.mutate(d))} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><Input {...regCreate('name', { required: true })} placeholder="Full name" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label><Input type="email" {...regCreate('email', { required: true })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><Input type="password" {...regCreate('password', { required: true })} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <Select {...regCreate('role')}><option value="user">User</option><option value="admin">Admin</option></Select>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Create</Button></div>
          </form>
        </Modal>
      )}

      {resetUserId && (
        <Modal open onClose={() => setResetUserId(null)} title="Reset Password">
          <form onSubmit={hsReset((d) => resetPw.mutate({ id: resetUserId, password: d.password }))} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">New Password</label><Input type="password" {...regReset('password', { required: true, minLength: 6 })} /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setResetUserId(null)}>Cancel</Button><Button type="submit">Reset</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
