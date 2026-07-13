import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExternalLink, Zap, Trash2, CheckCircle2, Edit2, X } from 'lucide-react';

// ── Slack logo SVG (inline, no external dep) ──────────────────────────────────
function SlackLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 123 123" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9Z" fill="#E01E5A"/>
      <path d="M32.3 77.6a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 0 1-25.8 0V77.6Z" fill="#E01E5A"/>
      <path d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2Z" fill="#36C5F0"/>
      <path d="M45.2 32.3a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 0 1 0-25.8h32.3Z" fill="#36C5F0"/>
      <path d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2Z" fill="#2EB67D"/>
      <path d="M90.5 45.2a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 0 1 25.8 0v32.3Z" fill="#2EB67D"/>
      <path d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9Z" fill="#ECB22E"/>
      <path d="M77.6 90.5a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 0 1 0 25.8H77.6Z" fill="#ECB22E"/>
    </svg>
  );
}

// ── Mask URL: show first 30 chars + *** ───────────────────────────────────────
function maskUrl(url) {
  if (!url) return '';
  return url.slice(0, 30) + '***';
}

// ── Main component ────────────────────────────────────────────────────────────
export function SlackSettings({ projectId }) {
  const qc = useQueryClient();

  const [editing, setEditing]   = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  // Fetch current project data (which contains slack_webhook_url)
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data),
    enabled: !!projectId,
  });

  const currentUrl = project?.slack_webhook_url ?? '';

  // Save / update webhook URL
  const save = useMutation({
    mutationFn: (url) => api.patch(`/projects/${projectId}`, { slack_webhook_url: url }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success(inputUrl ? 'Slack webhook URL saved' : 'Slack integration removed');
      setEditing(false);
      setInputUrl('');
      setUrlError('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to save webhook URL'),
  });

  // Test ping
  const test = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/slack-test`),
    onSuccess: () => toast.success('Test message sent to Slack!'),
    onError:   () => toast.error('Slack test failed — check your webhook URL'),
  });

  // Remove URL
  const remove = useMutation({
    mutationFn: () => api.patch(`/projects/${projectId}`, { slack_webhook_url: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Slack integration removed');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to remove webhook'),
  });

  function validateAndSave() {
    const trimmed = inputUrl.trim();
    if (!trimmed.startsWith('https://hooks.slack.com/') && !trimmed.startsWith('https://')) {
      setUrlError('Must be a valid https:// URL');
      return;
    }
    setUrlError('');
    save.mutate(trimmed);
  }

  function openEditing() {
    setInputUrl('');
    setUrlError('');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setInputUrl('');
    setUrlError('');
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2.5">
        <SlackLogo size={20} />
        <h3 className="font-bold text-gray-800 text-sm">Slack Integration</h3>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">

        {/* Current webhook status */}
        {currentUrl ? (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 size={15} className="text-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">Slack webhook configured</p>
              <p
                className="text-xs text-gray-400 font-mono mt-0.5 break-all"
                title={currentUrl}
              >
                {maskUrl(currentUrl)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
              <SlackLogo size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">No Slack webhook configured</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Connect a Slack channel to receive project notifications.
              </p>
            </div>
          </div>
        )}

        {/* Edit / input field */}
        {editing ? (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              Slack incoming webhook URL
            </label>
            <div className="flex gap-2">
              <Input
                value={inputUrl}
                onChange={(e) => { setInputUrl(e.target.value); setUrlError(''); }}
                placeholder="https://hooks.slack.com/services/…"
                autoFocus
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && validateAndSave()}
              />
              <Button onClick={validateAndSave} disabled={save.isPending || !inputUrl.trim()}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" size="icon" onClick={cancelEditing} title="Cancel">
                <X size={16} />
              </Button>
            </div>
            {urlError && <p className="text-xs text-red-500">{urlError}</p>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={openEditing}>
              <Edit2 size={13} />
              {currentUrl ? 'Update Webhook URL' : 'Add Webhook URL'}
            </Button>

            {currentUrl && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => test.mutate()}
                  disabled={test.isPending}
                  title="Sends a test message to your Slack channel"
                >
                  <Zap size={13} />
                  {test.isPending ? 'Sending…' : 'Test'}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (!confirm('Remove Slack integration from this project?')) return;
                    remove.mutate();
                  }}
                  disabled={remove.isPending}
                >
                  <Trash2 size={13} />
                  {remove.isPending ? 'Removing…' : 'Remove'}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Help text */}
        <div className="border-t border-gray-50 pt-4">
          <p className="text-xs text-gray-400 leading-relaxed">
            Get your webhook URL from{' '}
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-indigo-500 hover:underline font-medium"
            >
              api.slack.com/apps <ExternalLink size={10} />
            </a>
            . Create an app, enable{' '}
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-600">Incoming Webhooks</span>,
            then copy the webhook URL for your channel.
          </p>
        </div>
      </div>
    </div>
  );
}
