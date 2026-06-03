import { useEffect, useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { CheckSquare, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';

export function VerifyEmailPage() {
  const { token } = useParams({ from: '/verify-email/$token' });
  const [status, setStatus] = useState('loading'); // loading | success | error

  useEffect(() => {
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TaskFlow</h1>
        </div>
        <div className="bg-white/95 rounded-2xl shadow-2xl p-8 text-center">
          {status === 'loading' && <><Loader2 size={32} className="animate-spin mx-auto text-indigo-500 mb-3" /><p className="text-gray-600">Verifying…</p></>}
          {status === 'success' && (
            <>
              <CheckCircle2 size={40} className="text-green-500 mx-auto mb-3" />
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
