import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useLogin } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { CheckSquare, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@/lib/api';

const GOOGLE_OAUTH_ENABLED = import.meta.env.VITE_GOOGLE_OAUTH === 'true';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);

  // 2FA step state
  const [totpStep, setTotpStep] = useState(false);
  const [totpUserId, setTotpUserId] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpPending, setTotpPending] = useState(false);
  const totpRef = useRef(null);

  const login = useLogin();
  const { login: storeLogin } = useAuthStore();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/app/dashboard' });
  }, [isAuthenticated]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'oauth') setError(t('auth.oauthFailed'));
  }, []);

  // Auto-focus OTP input when step appears
  useEffect(() => {
    if (totpStep) setTimeout(() => totpRef.current?.focus(), 50);
  }, [totpStep]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (data.requiresTwoFactor) {
            setTotpUserId(data.userId);
            setTotpStep(true);
          } else {
            navigate({ to: '/app/dashboard' });
          }
        },
        onError: (err) => setError(err.response?.data?.error || t('auth.loginFailed')),
      }
    );
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    if (!totpCode.trim()) return;
    setError('');
    setTotpPending(true);
    try {
      const { data } = await api.post('/auth/2fa/verify', { userId: totpUserId, token: totpCode });
      storeLogin(data.accessToken, data.user);
      navigate({ to: '/app/dashboard' });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid verification code');
      setTotpCode('');
    } finally {
      setTotpPending(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = '/api/auth/google';
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            {totpStep
              ? <ShieldCheck size={28} className="text-white" />
              : <CheckSquare size={28} className="text-white" />
            }
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tick</h1>
          <p className="text-indigo-200/60 text-sm mt-2">
            {totpStep ? 'Two-factor authentication' : t('auth.signInSubtitle')}
          </p>
        </div>

        {/* ── TOTP step ─────────────────────────────────────────────────────── */}
        {totpStep ? (
          <form
            onSubmit={handleTotpSubmit}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-8 space-y-5"
          >
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <p className="text-sm text-gray-600 text-center">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Verification code</label>
              <input
                ref={totpRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-widest font-mono border border-gray-300 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <Button type="submit" size="lg" disabled={totpPending || totpCode.length !== 6} className="w-full">
              {totpPending ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              onClick={() => { setTotpStep(false); setTotpCode(''); setError(''); }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back to login
            </button>
          </form>
        ) : (
          /* ── Password step ───────────────────────────────────────────────── */
          <form
            onSubmit={handleSubmit}
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-8 space-y-5"
          >
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            {GOOGLE_OAUTH_ENABLED && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t('auth.continueGoogle')}
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                  <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">{t('auth.or')}</div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.emailAddress')}</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <div className="flex items-center justify-between">
              <Button type="submit" size="lg" disabled={login.isPending} className="flex-1">
                {login.isPending ? t('auth.signingIn') : t('auth.signIn')}
              </Button>
            </div>
            <div className="text-center">
              <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-indigo-200/60 mt-5">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-indigo-300 hover:text-white font-medium transition-colors">{t('auth.signUp')}</Link>
        </p>
        <p className="text-center text-xs text-indigo-200/30 mt-3">
          <Link to="/privacy" className="hover:text-indigo-200/60 transition-colors">Privacy Policy</Link>
          {' · '}
          <Link to="/terms" className="hover:text-indigo-200/60 transition-colors">Terms of Service</Link>
        </p>

        {!totpStep && (
          <div className="text-center mt-3">
            <button
              type="button"
              onClick={() => setShowHint((v) => !v)}
              className="text-xs text-indigo-200/30 hover:text-indigo-200/60 transition-colors underline underline-offset-2"
            >
              {showHint ? 'Hide demo credentials' : 'Show demo credentials'}
            </button>
            {showHint && (
              <p className="text-xs text-indigo-200/60 mt-1.5 font-mono bg-white/5 rounded-lg px-3 py-2 inline-block">
                admin@taskflow.local / admin123
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
