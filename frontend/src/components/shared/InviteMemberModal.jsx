import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function InviteMemberModal({ projectId, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [success, setSuccess] = useState(false);

  const invite = useMutation({
    mutationFn: (body) => api.post('/invitations', body),
    onSuccess: () => setSuccess(true),
  });

  function handleSubmit(e) {
    e.preventDefault();
    invite.mutate({ email: email.trim().toLowerCase(), projectId, role });
  }

  return (
    <Modal open onClose={onClose} title="Invite team member">
      {success ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Mail size={20} className="text-green-600" />
          </div>
          <p className="font-medium text-slate-900 dark:text-slate-100">Invitation sent!</p>
          <p className="text-sm text-slate-500 mt-1">
            {email} will receive an email with a link to join this project.
          </p>
          <Button className="mt-5" variant="outline" size="sm" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {invite.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
              {invite.error.response?.data?.error || 'Failed to send invitation'}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Email address *
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="viewer">Viewer — read only</option>
              <option value="member">Member — can create & edit tasks</option>
              <option value="project_manager">Project Manager — can manage members</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={invite.isPending}>
              {invite.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Send invitation'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
