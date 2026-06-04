import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useRegister } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { CheckSquare, Eye, EyeOff, CheckCircle2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function RegisterPage() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const register  = useRegister();
  const navigate  = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { t } = useTranslation();

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/app/dashboard' });
  }, [isAuthenticated]);

  function passwordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8)   score++;
    if (pw.length >= 12)  score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: t('auth.pwWeak'),      color: 'bg-red-500',     text: 'text-red-600' };
    if (score <= 2) return { score, label: t('auth.pwFair'),      color: 'bg-amber-400',   text: 'text-amber-600' };
    if (score <= 3) return { score, label: t('auth.pwGood'),      color: 'bg-yellow-400',  text: 'text-yellow-600' };
    if (score <= 4) return { score, label: t('auth.pwStrong'),    color: 'bg-emerald-500', text: 'text-emerald-600' };
    return           { score, label: t('auth.pwVeryStrong'),      color: 'bg-emerald-600', text: 'text-emerald-700' };
  }

  const pwStrength = passwordStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim())   { setError(t('auth.nameRequired')); return; }
    if (!email.trim())  { setError(t('auth.emailRequired')); return; }
    if (password.length < 6) { setError(t('auth.passwordTooShort')); return; }

    register.mutate(
      { name: name.trim(), email: email.trim(), password },
      {
        onSuccess: () => navigate({ to: '/app/dashboard' }),
        onError: (err) => setError(err.response?.data?.error || t('auth.registrationFailed')),
      }
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-800/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">TaskFlow</h1>
          <p className="text-indigo-200/60 text-sm mt-2">{t('auth.registerSubtitle')}</p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-5 text-xs text-indigo-300/60">
          <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-400" /> {t('auth.freeForever')}</span>
          <span className="flex items-center gap-1"><Shield size={11} className="text-emerald-400" /> {t('auth.gdprCompliant')}</span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.fullName')}</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.workEmail')}</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('auth.password')}</label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {password && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5].map((i) => (
                    <div
                      key={i}
                      className={cn('h-1 flex-1 rounded-full transition-all', i <= pwStrength.score ? pwStrength.color : 'bg-gray-200')}
                    />
                  ))}
                </div>
                <p className={cn('text-xs font-medium', pwStrength.text)}>{pwStrength.label}</p>
              </div>
            )}
            {!password && <p className="text-xs text-gray-400 mt-1">{t('auth.minPassword')}</p>}
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={register.isPending}>
            {register.isPending ? t('auth.creating') : t('auth.getStarted')}
          </Button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            {t('auth.noCardRequired')}
          </p>
        </form>

        <p className="text-center text-sm text-indigo-200/60 mt-5">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-indigo-300 hover:text-white font-medium transition-colors">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}
