import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { CheckSquare, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch {
      setSent(true); // still show success to prevent enumeration
    } finally {
      setLoading(false);
    }
  }

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

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/10 p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckSquare size={20} className="text-emerald-600" />
              </div>
              <h2 className="font-bold text-lg text-gray-900 mb-2">Check your email</h2>
              <p className="text-gray-500 text-sm">If an account exists for <strong>{email}</strong>, we sent a reset link. Check your spam folder too.</p>
              <Link to="/login" className="inline-block mt-5 text-indigo-600 text-sm font-medium hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-lg text-gray-900 mb-1">Forgot password?</h2>
              <p className="text-gray-500 text-sm mb-5">Enter your email and we'll send a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Link to="/login" className="text-sm text-indigo-600 hover:underline flex items-center justify-center gap-1">
                  <ArrowLeft size={13} /> Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
