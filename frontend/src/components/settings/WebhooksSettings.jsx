import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Zap, CheckCircle2, XCircle, Globe } from 'lucide-react';

// ── Available webhook event types ─────────────────────────────────────────────
const ALL_EVENTS = [
  { value: 'task.created',    label: 'Task created' },
  { value: 'task.updated',    label: 'Task updated' },
  { value: 'task.deleted',    label: 'Task deleted' },
  { value: 'task.completed',  label: 'Task completed' },
  { value: 'comment.created', label: 'Comment created' },
];

// ── Event badge ───────────────────────────────────────────────────────────────
function EventBadge({ event }) {
  const isTask = event.startsWith('task.');
  return (
    <span className={cn(
      'px-2 py-0.5 rounded-full text-xs font-medium border',
      isTask
        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
        : 'bg-purple-50 text-purple-700 border-purple-200'
    )}>
      {event}
    </span>
  );
}

// ── Add Webhook Modal ─────────────────────────────────────────────────────────
function AddWebhookModal({ projectId, onClose }) {
  const qc = useQueryClient();
  const [url, setUrl]         = useState('');
  const [secret, setSecret]   = useState('');
  const [events, setEvents]   = useState(['task.created', 'task.completed']);
  const [urlError, setUrlError] = useState('');

  function toggleEvent(ev) {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  }

  function validateUrl(value) {
    if (!value.startsWith('https://')) {
      setUrlError('URL must start with https://');
      return false;
    }
    setUrlError('');
    return true;
  }

  const create = useMutation({
    mutationFn: (payload) => api.post(`/projects/${projectId}/webhooks`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', projectId] });
      toast.success('Webhook added');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add webhook'),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!validateUrl(url)) return;
    if (events.length === 0) {
      toast.error('Select at least one event');
      return;
    }
    create.mutate({ url, secret: secret || undefined, events });
  }

  return (
    <Modal open onClose={onClose} title="Add Webhook">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* URL */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Endpoint URL <span className="text-red-500">*</span>
          </label>
          <Input
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (urlError) validateUrl(e.target.value); }}
            placeholder="https://your-server.com/webhook"
            required
          />
          {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
          <p className="text-xs text-gray-400 mt-1">Must be an HTTPS endpoint publicly reachable by our servers.</p>
        </div>

        {/* Events */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Events <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {ALL_EVENTS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={events.includes(value)}
                  onChange={() => toggleEvent(value)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                <EventBadge event={value} />
              </label>
            ))}
          </div>
        </div>

        {/* Secret */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Secret <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <Input
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Used to sign the payload (HMAC-SHA256)"
            type="password"
            autoComplete="new-password"
          />
          <p className="text-xs text-gray-400 mt-1">
            We'll include a <code className="bg-gray-100 px-1 rounded">X-Tick-Signature</code> header on each request.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || !url}>
            {create.isPending ? 'Adding…' : 'Add Webhook'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Webhook row ───────────────────────────────────────────────────────────────
function WebhookRow({ webhook, projectId }) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = useMutation({
    mutationFn: () =>
      api.patch(`/projects/${projectId}/webhooks/${webhook.id}`, { is_active: !webhook.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', projectId] });
      toast.success(webhook.is_active ? 'Webhook disabled' : 'Webhook enabled');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update webhook'),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/webhooks/${webhook.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks', projectId] });
      toast.success('Webhook deleted');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete webhook'),
  });

  const ping = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/webhooks/${webhook.id}/test`),
    onSuccess: () => toast.success('Test ping delivered successfully'),
    onError:  () => toast.error('Test ping failed — check your endpoint'),
  });

  // Truncate URL for display
  const displayUrl = webhook.url.length > 55
    ? webhook.url.slice(0, 55) + '…'
    : webhook.url;

  return (
    <div className="p-4 space-y-3">
      {/* URL + status */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Globe size={15} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 break-all leading-snug">{displayUrl}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {(webhook.events ?? []).map((ev) => <EventBadge key={ev} event={ev} />)}
          </div>
        </div>
        {/* Active badge */}
        <span className={cn(
          'shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
          webhook.is_active
            ? 'bg-green-100 text-green-700'
            : 'bg-gray-100 text-gray-500'
        )}>
          {webhook.is_active
            ? <><CheckCircle2 size={11} /> Active</>
            : <><XCircle size={11} /> Inactive</>
          }
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pl-11">
        {/* Toggle active */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
        >
          {webhook.is_active ? 'Disable' : 'Enable'}
        </Button>

        {/* Test ping */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => ping.mutate()}
          disabled={ping.isPending || !webhook.is_active}
          title={!webhook.is_active ? 'Enable the webhook first' : undefined}
        >
          <Zap size={13} />
          {ping.isPending ? 'Sending…' : 'Test'}
        </Button>

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-red-600 font-medium">Delete?</span>
            <Button size="sm" variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting…' : 'Yes, delete'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            title="Delete webhook"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function WebhooksSettings({ projectId }) {
  const [showAdd, setShowAdd] = useState(false);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: () => api.get(`/projects/${projectId}/webhooks`).then((r) => r.data),
    enabled: !!projectId,
  });

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Webhooks</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Send HTTP POST payloads to an external URL when project events occur.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Webhook
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="py-12 text-center">
            <div className="inline-flex w-12 h-12 rounded-full bg-gray-50 items-center justify-center mb-3">
              <Globe size={22} className="text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">No webhooks configured</p>
            <p className="text-xs text-gray-400 mt-1">
              Add a webhook to receive real-time event notifications.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {webhooks.map((wh) => (
              <WebhookRow key={wh.id} webhook={wh} projectId={projectId} />
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddWebhookModal projectId={projectId} onClose={() => setShowAdd(false)} />
      )}
    </div>
  );
}
