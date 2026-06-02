import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) { navigate({ to: '/login?error=oauth' }); return; }

    // Token from URL — fetch user info and store
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    api.get('/users/' + 'me').catch(() => null);

    // Decode user from JWT payload (non-sensitive)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      login(token, { id: payload.id, email: payload.email, name: payload.name, role: payload.role });
      navigate({ to: '/app/dashboard' });
    } catch {
      navigate({ to: '/login?error=oauth' });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900">
      <div className="text-center text-white">
        <Loader2 size={32} className="animate-spin mx-auto mb-3" />
        <p className="text-indigo-200">Signing you in…</p>
      </div>
    </div>
  );
}
