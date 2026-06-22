import { useState } from 'react';
import { MailWarning, X, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';

export function EmailVerificationBanner() {
  const { emailVerified, user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (emailVerified || dismissed || !user) return null;

  async function handleResend() {
    setSending(true);
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent — check your inbox');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="shrink-0 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700/50 px-4 py-2.5 flex items-center gap-3">
      <MailWarning size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
        <span className="font-medium">Verify your email</span>
        {' — '}we sent a link to <span className="font-mono text-xs">{user.email}</span>.
        Some features are restricted until you confirm.
      </p>
      <button
        onClick={handleResend}
        disabled={sending}
        className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-white transition-colors shrink-0 disabled:opacity-50"
      >
        <RefreshCw size={12} className={sending ? 'animate-spin' : ''} />
        {sending ? 'Sending…' : 'Resend'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors shrink-0 p-0.5 rounded"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
