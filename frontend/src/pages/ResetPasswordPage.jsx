import { useState } from 'react';
import { useNavigate, useParams, Link } from '@tanstack/react-router';
import { CheckSquare } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export function ResetPasswordPage() {
  const { token } = useParams({ from: '/reset-password/$token' });
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate({ to: '/login?reset=1' });
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. Link may have expired.');
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
          <h2 className="font-bold text-lg text-gray-900 mb-5">Set new password</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Same password again" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Saving…' : 'Set new password'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-indigo-600 hover:underline">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
