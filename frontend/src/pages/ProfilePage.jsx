import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { getGroupedTimezones, getCurrentTimezone } from '@/lib/timezones';
import { CheckCircle2, User, Globe, Lock } from 'lucide-react';

const grouped = getGroupedTimezones();

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100 dark:border-slate-700">
        <Icon size={18} className="text-indigo-500" />
        <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [name, setName]         = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || getCurrentTimezone());
  const [saved, setSaved]       = useState(false);

  // Password change state
  const [curPw,  setCurPw]  = useState('');
  const [newPw,  setNewPw]  = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMsg,  setPwMsg]  = useState('');

  useEffect(() => {
    setName(user?.name || '');
    setTimezone(user?.timezone || getCurrentTimezone());
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: (d) => api.patch(`/users/${user?.id}`, d),
    onSuccess: () => {
      updateUser({ name, timezone });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const changePassword = useMutation({
    mutationFn: (d) => api.patch(`/users/${user?.id}/password`, d),
    onSuccess: () => {
      setPwMsg('success');
      setCurPw(''); setNewPw(''); setConfPw('');
      setTimeout(() => setPwMsg(''), 3000);
    },
    onError: () => setPwMsg('error'),
  });

  function handlePasswordChange(e) {
    e.preventDefault();
    if (!newPw || !confPw) { setPwMsg('empty'); return; }
    if (newPw !== confPw) { setPwMsg('mismatch'); return; }
    if (newPw.length < 6) { setPwMsg('short'); return; }
    changePassword.mutate({ password: newPw });
  }

  const pwMessages = {
    success:  { text: 'Password changed successfully!', cls: 'text-emerald-600' },
    mismatch: { text: 'New passwords do not match.',    cls: 'text-red-600' },
    short:    { text: 'Password must be at least 6 characters.', cls: 'text-red-600' },
    empty:    { text: 'Please fill in both password fields.', cls: 'text-red-600' },
    error:    { text: 'Failed to change password.',     cls: 'text-red-600' },
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 page-fade">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Profile</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Manage your account details and preferences</p>
      </div>

      {/* Avatar card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 flex items-center gap-5 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30">
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-black shadow-inner">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-xl font-bold text-white">{user?.name}</p>
          <p className="text-indigo-200 text-sm">{user?.email}</p>
          <span className="mt-1 inline-block px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded-full capitalize">
            {user?.role}
          </span>
        </div>
      </div>

      {/* Profile details */}
      <Section title="Profile Details" icon={User}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Display Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <Input value={user?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed. Contact admin.</p>
          </div>

          <div className="flex justify-between items-center pt-2">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle2 size={15} /> Saved!
              </span>
            )}
            {!saved && <div />}
            <Button
              onClick={() => updateProfile.mutate({ name, timezone })}
              disabled={updateProfile.isPending || !name.trim()}
            >
              {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Section>

      {/* Timezone */}
      <Section title="Timezone & Locale" icon={Globe}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {grouped.map(([region, zones]) => (
                <optgroup key={region} label={region}>
                  {zones.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              Current system timezone: <strong>{getCurrentTimezone()}</strong>
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={() => updateProfile.mutate({ name, timezone })}
              disabled={updateProfile.isPending}
            >
              Save Timezone
            </Button>
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title="Change Password" icon={Lock}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              New Password
            </label>
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confPw}
              onChange={(e) => setConfPw(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
          </div>

          {pwMsg && (
            <p className={`text-sm font-medium ${pwMessages[pwMsg]?.cls}`}>
              {pwMessages[pwMsg]?.text}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Changing…' : 'Change Password'}
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
