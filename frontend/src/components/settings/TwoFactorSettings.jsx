import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ShieldCheck, ShieldOff, KeyRound, Smartphone, Copy, CheckCircle2 } from 'lucide-react';

// ── Setup flow (shown when 2FA is disabled) ───────────────────────────────────
function SetupFlow({ onClose }) {
  const { updateUser } = useAuthStore();
  const [step, setStep]         = useState('idle'); // idle | loading | ready
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [otp, setOtp]           = useState('');
  const [copied, setCopied]     = useState(false);

  // Step 1: fetch QR code from backend
  async function startSetup() {
    setStep('loading');
    try {
      const { data } = await api.get('/auth/2fa/setup');
      setQrDataUrl(data.qr_data_url);
      setManualCode(data.manual_entry_code ?? data.secret ?? '');
      setStep('ready');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start 2FA setup');
      setStep('idle');
    }
  }

  // Step 2: verify the TOTP code
  const verify = useMutation({
    mutationFn: () => api.post('/auth/2fa/verify-setup', { token: otp }),
    onSuccess: () => {
      updateUser({ two_factor_enabled: true });
      toast.success('Two-factor authentication enabled');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Verification failed — check your code'),
  });

  function copyCode() {
    navigator.clipboard.writeText(manualCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Initial state: button to begin ────────────────────────────────────────
  if (step === 'idle') {
    return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">Two-factor authentication is disabled</p>
          <p className="text-xs text-gray-500 mt-0.5">Add an extra layer of security using an authenticator app.</p>
        </div>
        <Button onClick={startSetup} className="shrink-0">
          <ShieldCheck size={15} /> Enable 2FA
        </Button>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        Generating QR code…
      </div>
    );
  }

  // ── Ready: show QR + verify input ─────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Step indicators */}
      <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
          Scan QR code
        </span>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-[10px] font-bold">2</span>
          Enter code
        </span>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center gap-3 p-5 bg-gray-50 rounded-xl border border-gray-100">
        <Smartphone size={18} className="text-gray-400" />
        <p className="text-xs text-center text-gray-500 max-w-xs">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
        </p>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="2FA QR code"
            className="w-44 h-44 rounded-xl border border-gray-200 bg-white p-2"
          />
        )}
      </div>

      {/* Manual entry code */}
      {manualCode && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
            <KeyRound size={12} /> Can't scan? Enter this code manually:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono bg-gray-50 rounded-xl px-3 py-1.5 text-gray-800 select-all break-all">
              {manualCode}
            </code>
            <button
              onClick={copyCode}
              className="shrink-0 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Copy code"
            >
              {copied ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      {/* OTP input */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Verification code
        </label>
        <div className="flex gap-2">
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code from your app"
            inputMode="numeric"
            maxLength={6}
            className="tracking-widest text-center text-lg font-mono"
            onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && verify.mutate()}
          />
          <Button
            onClick={() => verify.mutate()}
            disabled={otp.length !== 6 || verify.isPending}
          >
            {verify.isPending ? 'Verifying…' : 'Verify & Enable'}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Enter the 6-digit code shown in your authenticator app.
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400">
        Cancel setup
      </Button>
    </div>
  );
}

// ── Disable flow ──────────────────────────────────────────────────────────────
function DisableModal({ onClose }) {
  const { updateUser } = useAuthStore();
  const [otp, setOtp] = useState('');

  const disable = useMutation({
    mutationFn: () => api.post('/auth/2fa/disable', { token: otp }),
    onSuccess: () => {
      updateUser({ two_factor_enabled: false });
      toast.success('Two-factor authentication disabled');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Incorrect code — try again'),
  });

  return (
    <Modal open onClose={onClose} title="Disable Two-Factor Authentication">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <ShieldOff size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>Disabling 2FA reduces your account security. You'll only need your password to sign in.</span>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Current authenticator code
          </label>
          <Input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
            className="tracking-widest text-center font-mono text-lg"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={otp.length !== 6 || disable.isPending}
            onClick={() => disable.mutate()}
          >
            {disable.isPending ? 'Disabling…' : 'Disable 2FA'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main exported component ───────────────────────────────────────────────────
export function TwoFactorSettings() {
  const { user } = useAuthStore();
  const isEnabled = !!user?.two_factor_enabled;
  const [showDisable, setShowDisable] = useState(false);

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="flex items-center gap-2 mb-1">
        {isEnabled ? (
          <ShieldCheck size={18} className="text-emerald-500" />
        ) : (
          <ShieldOff size={18} className="text-gray-400" />
        )}
        <h3 className="font-bold text-gray-800 text-sm">Two-Factor Authentication</h3>
        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          isEnabled
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {isEnabled ? <><CheckCircle2 size={11} /> Enabled</> : 'Disabled'}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {isEnabled ? (
          // ── Enabled state ────────────────────────────────────────────────
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">2FA is active on your account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Your account is protected. You'll need your authenticator app to sign in.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setShowDisable(true)} className="shrink-0">
              <ShieldOff size={14} /> Disable 2FA
            </Button>
          </div>
        ) : (
          // ── Disabled state ───────────────────────────────────────────────
          <SetupFlow onClose={() => {}} />
        )}
      </div>

      {/* Disable confirmation modal */}
      {showDisable && <DisableModal onClose={() => setShowDisable(false)} />}
    </div>
  );
}
