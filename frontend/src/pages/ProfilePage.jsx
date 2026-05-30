import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: (d) => api.patch(`/users/${user?.id}`, d),
    onSuccess: () => {
      updateUser({ name, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-6">My Profile</h2>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={user?.name} src={user?.avatar_url} size="lg" />
          <div>
            <p className="font-semibold text-gray-900 text-lg">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${user?.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
              {user?.role}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
        </div>

        <div className="flex justify-end">
          <Button onClick={() => update.mutate({ name, timezone })} disabled={update.isPending}>
            {saved ? 'Saved!' : update.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
