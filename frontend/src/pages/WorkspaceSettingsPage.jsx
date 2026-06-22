import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { Building2, Users, Trash2, Crown, Shield, User, Plus, X } from 'lucide-react';
import { useWorkspace, useUpdateWorkspace, useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole, useRemoveWorkspaceMember } from '@/hooks/useWorkspaces';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const ROLE_ICON = { owner: Crown, admin: Shield, member: User };
const ROLE_LABEL = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ROLE_COLOR = { owner: 'text-amber-500', admin: 'text-indigo-400', member: 'text-slate-400' };

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

export function WorkspaceSettingsPage() {
  const { workspaceId } = useParams({ strict: false });
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const { user } = useAuthStore();
  const updateWs = useUpdateWorkspace(workspaceId);
  const addMember = useAddWorkspaceMember(workspaceId);
  const updateRole = useUpdateWorkspaceMemberRole(workspaceId);
  const removeMember = useRemoveWorkspaceMember(workspaceId);

  const [name, setName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [editingName, setEditingName] = useState(false);

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading workspace…</div>;
  if (!workspace) return <div className="p-6 text-sm text-red-500">Workspace not found.</div>;

  const myRole = workspace.member_role;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  function handleRename(e) {
    e.preventDefault();
    if (!name.trim()) return;
    updateWs.mutate({ name: name.trim() }, { onSuccess: () => setEditingName(false) });
  }

  function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    addMember.mutate({ email: inviteEmail.trim(), role: inviteRole }, {
      onSuccess: () => { setInviteEmail(''); setInviteRole('member'); },
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Building2 size={22} className="text-indigo-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{workspace.name}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Workspace settings · {workspace.plan} plan
          </p>
        </div>
      </div>

      {/* General */}
      {isAdmin && (
        <Section title="General">
          {editingName ? (
            <form onSubmit={handleRename} className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={workspace.name}
                autoFocus
              />
              <Button type="submit" disabled={updateWs.isPending || !name.trim()}>
                {updateWs.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => { setEditingName(false); setName(''); }}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Workspace name</p>
                <p className="text-sm text-gray-500 dark:text-slate-400">{workspace.name}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => { setName(workspace.name); setEditingName(true); }}>
                Rename
              </Button>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              <span className="font-medium text-gray-700 dark:text-slate-300">Slug:</span>{' '}
              <code className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">{workspace.slug}</code>
            </p>
          </div>
        </Section>
      )}

      {/* Members */}
      <Section title="Members">
        {isAdmin && (
          <form onSubmit={handleInvite} className="flex gap-2 mb-4">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              type="email"
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm px-3 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" disabled={addMember.isPending || !inviteEmail.trim()}>
              <Plus size={14} /> Add
            </Button>
          </form>
        )}

        <div className="space-y-2">
          {(workspace.members || []).map((m) => {
            const RoleIcon = ROLE_ICON[m.role] || User;
            const isSelf = m.id === user?.id;
            const canModify = isAdmin && m.role !== 'owner' && !isSelf;
            return (
              <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {m.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {m.name} {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{m.email}</p>
                </div>
                <div className={cn('flex items-center gap-1 text-xs font-medium', ROLE_COLOR[m.role])}>
                  <RoleIcon size={12} />
                  {canModify ? (
                    <select
                      value={m.role}
                      onChange={(e) => updateRole.mutate({ userId: m.id, role: e.target.value })}
                      className="bg-transparent text-xs font-medium cursor-pointer focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span>{ROLE_LABEL[m.role]}</span>
                  )}
                </div>
                {canModify && (
                  <button
                    onClick={() => { if (confirm(`Remove ${m.name} from workspace?`)) removeMember.mutate(m.id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                    title="Remove member"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Plan info */}
      <Section title="Plan">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 capitalize">
              {workspace.plan} plan
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {workspace.plan === 'free'
                ? 'Up to 1 project, 5 members, 100 tasks'
                : workspace.plan === 'pro'
                ? 'Unlimited projects, up to 20 members'
                : 'Unlimited everything + priority support'}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => window.location.href = '/app/billing'}>
            Upgrade
          </Button>
        </div>
      </Section>
    </div>
  );
}

// cn helper (import if not auto-imported)
function cn(...classes) { return classes.filter(Boolean).join(' '); }
