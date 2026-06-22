import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { CheckSquare, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

export function AcceptInvitePage() {
  const { token } = useParams({ from: '/invite/$token' });
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/invitations/${token}`)
      .then(({ data }) => setInvite(data))
      .catch(() => setError('This invitation link is invalid or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post(`/invitations/${token}/accept`, { name, password });
      login(data.accessToken, data.user);
      navigate({ to: `/app/projects/${data.projectId}/board` });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
            <CheckSquare size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Tick</h1>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-2xl p-8">
          {error && !invite ? (
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">Invalid Invitation</p>
              <p className="text-gray-500 text-sm">{error}</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">You're invited!</h2>
                <p className="text-gray-500 text-sm mt-1">
                  <strong>{invite?.inviterName}</strong> invited you to join{' '}
                  <strong>{invite?.projectName}</strong>
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleAccept} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Create a password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Joining as: <span className="font-mono">{invite?.email}</span>
                </p>
                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? 'Joining…' : 'Accept & Join Project'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
