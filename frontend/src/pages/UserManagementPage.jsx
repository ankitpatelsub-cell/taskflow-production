import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_LABELS, ROLE_COLORS, ROLE_DESCRIPTIONS, ALL_ROLES, isSuperAdmin, isAdminOrAbove } from '@/lib/roles';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useForm } from 'react-hook-form';
import { Plus, UserX, UserCheck, Key, Mail, Shield, Users, Search, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { getGroupedTimezones, getCurrentTimezone } from '@/lib/timezones';

const grouped = getGroupedTimezones();

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 shadow-sm flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  );
}

// ─── Add / Edit User Modal ────────────────────────────────────────────────────
function UserFormModal({ onClose, editUser = null }) {
  const isEdit = !!editUser;
  const { user: currentUser } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: isEdit
      ? { name: editUser.name, email: editUser.email, role: editUser.role, timezone: editUser.timezone || 'UTC' }
      : { role: 'member', timezone: getCurrentTimezone() },
  });

  const create = useMutation({
    mutationFn: (d) => api.post('/users', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to create user'),
  });
  const update = useMutation({
    mutationFn: (d) => api.patch(`/users/${editUser.id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); onClose(); },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update user'),
  });

  const onSubmit = (data) => isEdit ? update.mutate(data) : create.mutate(data);
  const isPending = create.isPending || update.isPending;
  const error = create.error || update.error;

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit — ${editUser.name}` : 'Add New User'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertTriangle size={15} />
            {error.response?.data?.error || 'Something went wrong'}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
          <Input {...register('name', { required: 'Name is required' })} placeholder="e.g. Priya Sharma" />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
          <Input
            type="email"
            {...register('email', { required: 'Email is required' })}
            placeholder="user@company.com"
            disabled={isEdit}
            className={isEdit ? 'opacity-60 cursor-not-allowed' : ''}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>

        {/* Password — only on create */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password *</label>
            <Input
              type="password"
              {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>
        )}

        {/* Role + Timezone side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
            <Select {...register('role')}>
              {ALL_ROLES
                .filter((r) => isSuperAdmin(currentUser?.role) || r !== 'super_admin')
                .map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))
              }
            </Select>
            <p className="text-xs text-gray-400 mt-1">
              {/* Show description dynamically — just a static hint here */}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Timezone</label>
            <select
              {...register('timezone')}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {grouped.map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create User')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────
function ResetPasswordModal({ user: targetUser, onClose }) {
  const [pw, setPw] = useState('');
  const [copied, setCopied] = useState(false);

  const reset = useMutation({
    mutationFn: () => api.patch(`/users/${targetUser.id}/password`, { password: pw }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); onClose(); },
  });

  function generateRandom() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!';
    const pass = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPw(pass);
  }

  function copyPw() {
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open onClose={onClose} title={`Reset Password — ${targetUser.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Set a new password for <strong>{targetUser.email}</strong>. Share it securely with the user.</p>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
          <div className="flex gap-2">
            <Input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Enter or generate password" className="flex-1" />
            <Button type="button" variant="secondary" size="sm" onClick={generateRandom}>Generate</Button>
            {pw && <Button type="button" variant="secondary" size="sm" onClick={copyPw}>{copied ? '✓' : 'Copy'}</Button>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!pw || pw.length < 6 || reset.isPending}
            onClick={() => {
              if (!confirm(`Reset password for ${targetUser.name}? Make sure to share the new password with them securely.`)) return;
              reset.mutate();
            }}
          >
            {reset.isPending ? 'Resetting…' : 'Reset Password'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function UserManagementPage() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then((r) => r.data),
  });

  const [showAdd,    setShowAdd]    = useState(false);
  const [editUser,   setEditUser]   = useState(null);
  const [resetUser,  setResetUser]  = useState(null);
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const toggle = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/users/${id}`, { is_active }),
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(is_active ? 'User activated' : 'User deactivated');
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Failed to update user'),
  });

  const filtered = users.filter((u) => {
    const matchName  = u.name.toLowerCase().includes(search.toLowerCase()) ||
                       u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole  = roleFilter ? u.role === roleFilter : true;
    return matchName && matchRole;
  });

  const total   = users.length;
  const admins  = users.filter((u) => u.role === 'admin').length;
  const active  = users.filter((u) => u.is_active).length;

  return (
    <div className="p-6 max-w-5xl mx-auto page-fade">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Add, edit and manage workspace members</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Users"  value={total}  icon={Users}  color="bg-indigo-50 text-indigo-600" />
        <StatCard label="Active"       value={active} icon={UserCheck} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Admins"       value={admins} icon={Shield} color="bg-amber-50 text-amber-600" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-700/50">
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Timezone</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Users size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No users match your search</p>
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} src={u.avatar_url} />
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Mail size={10} />{u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}
                      title={ROLE_DESCRIPTIONS[u.role]}
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs text-gray-500 dark:text-slate-400">
                      {u.timezone || 'UTC'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      u.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-400">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditUser(u)}
                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors dark:hover:bg-indigo-900/30"
                        title="Edit user"
                      >
                        <Shield size={15} />
                      </button>
                      <button
                        onClick={() => setResetUser(u)}
                        className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors dark:hover:bg-amber-900/30"
                        title="Reset password"
                      >
                        <Key size={15} />
                      </button>
                      <button
                        onClick={() => toggle.mutate({ id: u.id, is_active: u.is_active ? 0 : 1 })}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.is_active
                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                            : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                        }`}
                        title={u.is_active ? 'Deactivate user' : 'Activate user'}
                      >
                        {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showAdd     && <UserFormModal onClose={() => setShowAdd(false)} />}
      {editUser    && <UserFormModal editUser={editUser} onClose={() => setEditUser(null)} />}
      {resetUser   && <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />}
    </div>
  );
}
