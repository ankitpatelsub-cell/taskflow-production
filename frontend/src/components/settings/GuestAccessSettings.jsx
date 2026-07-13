import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Link2, Trash2, Plus, Copy, CheckCircle2, Eye, MessageSquare, Edit3, Clock } from 'lucide-react';

const PERMISSION_INFO = {
  read:    { label: 'View only',    icon: Eye,            color: 'text-blue-500 bg-blue-50' },
  comment: { label: 'Can comment',  icon: MessageSquare,  color: 'text-amber-500 bg-amber-50' },
  edit:    { label: 'Can edit',     icon: Edit3,          color: 'text-emerald-500 bg-emerald-50' },
};

function PermissionBadge({ perm }) {
  const info = PERMISSION_INFO[perm] || PERMISSION_INFO.read;
  const Icon = info.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${info.color}`}>
      <Icon size={11} />
      {info.label}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
      title="Copy link"
    >
      {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

function CreateGuestLinkModal({ projectId, onClose }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [permissions, setPermissions] = useState('read');
  const [expiresDays, setExpiresDays] = useState('');
  const [newToken, setNewToken] = useState(null);

  const create = useMutation({
    mutationFn: (data) => api.post(`/projects/${projectId}/guests`, data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['guests', projectId] });
      const guestUrl = `${window.location.origin}/guest/${data.token}`;
      setNewToken(guestUrl);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create guest link'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return toast.error('Label is required');
    create.mutate({
      label: label.trim(),
      permissions,
      expires_days: expiresDays ? parseInt(expiresDays) : undefined,
    });
  }

  if (newToken) {
    return (
      <Modal open onClose={onClose} title="Guest link created">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-emerald-800">Guest link ready</p>
            <p className="text-xs text-emerald-600 mt-1">Share this link with your client or guest</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <Link2 size={14} className="text-gray-400 shrink-0" />
            <span className="text-xs font-mono text-gray-700 flex-1 break-all">{newToken}</span>
            <CopyButton text={newToken} />
          </div>
          <p className="text-xs text-gray-400 text-center">
            Copy this link now — for security, the full token won't be shown again.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Create guest link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Label *</label>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Acme Corp client review"
            autoFocus
            required
          />
          <p className="text-xs text-gray-400 mt-1">Helps you identify which link belongs to whom.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Permissions</label>
          <div className="flex gap-2">
            {Object.entries(PERMISSION_INFO).map(([key, info]) => {
              const Icon = info.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPermissions(key)}
                  className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    permissions === key
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <Icon size={16} />
                  {info.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Expiry <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="365"
              value={expiresDays}
              onChange={e => setExpiresDays(e.target.value)}
              placeholder="e.g. 30"
              className="w-28"
            />
            <span className="text-sm text-gray-500">days from now</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Leave blank for no expiry.</p>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !label.trim()}>
            {create.isPending ? 'Creating…' : 'Create link'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function GuestAccessSettings({ projectId }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['guests', projectId],
    queryFn: () => api.get(`/projects/${projectId}/guests`).then(r => r.data),
    enabled: !!projectId,
  });

  const revoke = useMutation({
    mutationFn: (id) => api.delete(`/projects/${projectId}/guests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests', projectId] });
      toast.success('Guest link revoked');
    },
    onError: () => toast.error('Failed to revoke link'),
  });

  const activeLinks = links.filter(l => !l.revoked_at);
  const revokedLinks = links.filter(l => l.revoked_at);

  if (isLoading) {
    return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-gray-500" />
          <span className="text-sm font-bold text-gray-700">Guest Access Links</span>
          <span className="text-xs text-gray-400">
            ({activeLinks.length} active)
          </span>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={13} />
          New guest link
        </Button>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        Share read-only or comment access with clients or external stakeholders — no account required.
        Links can be revoked at any time.
      </p>

      {activeLinks.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Link2 size={28} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active guest links</p>
          <p className="text-xs mt-1">Create one to share this project with external users</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLinks.map(link => (
            <div key={link.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 truncate">{link.label}</span>
                  <PermissionBadge perm={link.permissions} />
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-400">
                    Created by {link.created_by_name}
                  </span>
                  {link.expires_at && (
                    <span className="flex items-center gap-0.5 text-xs text-amber-500">
                      <Clock size={10} />
                      Expires {new Date(link.expires_at).toLocaleDateString()}
                    </span>
                  )}
                  {link.used_count > 0 && (
                    <span className="text-xs text-gray-400">{link.used_count} views</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  if (!confirm(`Revoke "${link.label}"? Anyone using this link will lose access immediately.`)) return;
                  revoke.mutate(link.id);
                }}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Revoke link"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {revokedLinks.length > 0 && (
        <details className="text-xs text-gray-400 cursor-pointer">
          <summary className="hover:text-gray-600 transition-colors">
            {revokedLinks.length} revoked link{revokedLinks.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 space-y-1 pl-2">
            {revokedLinks.map(link => (
              <div key={link.id} className="flex items-center gap-2 line-through opacity-60">
                <span>{link.label}</span>
                <PermissionBadge perm={link.permissions} />
              </div>
            ))}
          </div>
        </details>
      )}

      {showCreate && (
        <CreateGuestLinkModal projectId={projectId} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
