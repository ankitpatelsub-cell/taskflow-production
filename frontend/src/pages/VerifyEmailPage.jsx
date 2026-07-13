import { useEffect, useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { CheckSquare, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function VerifyEmailPage() {
  const { token } = useParams({ from: '/verify-email/$token' });
  const [status, setStatus] = useState('loading'); // loading | success | error

  const { setToken, setEmailVerified } = useAuthStore();

  useEffect(() => {
    api.post('/auth/verify-email', { token })
      .then(({ data }) => {
        // Update the stored token so the email_verified claim takes effect immediately
        if (data.accessToken) {
          setToken(data.accessToken);
          setEmailVerified(true);
        }
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-4 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-coral-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-coral-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Tick</h1>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-8 text-center">
          {status === 'loading' && <><Loader2 size={32} className="animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-gray-600">Verifying…</p></>}
          {status === 'success' && (
            <>
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
              <h2 className="font-bold text-lg text-gray-900 mb-2">Email verified!</h2>
              <p className="text-gray-500 text-sm mb-5">Your email address is confirmed.</p>
              <Link to="/app/dashboard" className="inline-block bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors">Go to Dashboard</Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={40} className="text-red-500 mx-auto mb-3" />
              <h2 className="font-bold text-lg text-gray-900 mb-2">Link expired</h2>
              <p className="text-gray-500 text-sm mb-5">This verification link is invalid or has expired. Log in and request a new one.</p>
              <Link to="/login" className="text-indigo-600 text-sm font-medium hover:underline">Back to sign in</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
