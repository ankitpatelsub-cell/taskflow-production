import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { getGroupedTimezones, getCurrentTimezone } from '@/lib/timezones';
import { CheckCircle2, User, Globe, Lock, Trash2, Download, AlertTriangle, Bell, Palette, Monitor, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { setLanguage, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import {
  getDesktopNotifEnabled,
  requestDesktopNotifPermission,
  disableDesktopNotifs,
} from '@/hooks/useDesktopNotifications';
import { useThemeStore } from '@/stores/themeStore';

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
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const [name, setName]         = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || getCurrentTimezone());
  const [saved, setSaved]       = useState(false);
  const [desktopNotif, setDesktopNotif] = useState(() => getDesktopNotifEnabled());
  const [notifStatus, setNotifStatus]   = useState(
    !('Notification' in window) ? 'unsupported' :
    Notification.permission === 'denied' ? 'denied' : null
  );

  // Password change state
  const [curPw,  setCurPw]  = useState('');
  const [newPw,  setNewPw]  = useState('');
  const [confPw, setConfPw] = useState('');
  const [pwMsg,  setPwMsg]  = useState('');

  // Account deletion state
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError,   setDeleteError]   = useState('');

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
    onError: (err) => setPwMsg(err?.response?.data?.error === 'Current password is incorrect' ? 'wrongcurrent' : 'error'),
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/account', { data: { confirm: 'DELETE' } }),
    onSuccess: () => useAuthStore.getState().logout(),
    onError: () => setDeleteError('Failed to delete account. Please try again.'),
  });

  function handlePasswordChange(e) {
    e.preventDefault();
    if (!curPw) { setPwMsg('nocurrent'); return; }
    if (!newPw || !confPw) { setPwMsg('empty'); return; }
    if (newPw !== confPw) { setPwMsg('mismatch'); return; }
    if (newPw.length < 6) { setPwMsg('short'); return; }
    changePassword.mutate({ currentPassword: curPw, password: newPw });
  }

  async function handleExportData() {
    const res = await fetch('/api/account/data-export', {
      headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'my-taskflow-data.json'; a.click();
    URL.revokeObjectURL(url);
  }

  const pwMessages = {
    success:      { text: 'Password changed successfully!',          cls: 'text-emerald-600' },
    mismatch:     { text: 'New passwords do not match.',             cls: 'text-red-600' },
    short:        { text: 'Password must be at least 6 characters.', cls: 'text-red-600' },
    empty:        { text: 'Please fill in both new password fields.', cls: 'text-red-600' },
    nocurrent:    { text: 'Please enter your current password.',      cls: 'text-red-600' },
    wrongcurrent: { text: 'Current password is incorrect.',          cls: 'text-red-600' },
    error:        { text: 'Failed to change password.',              cls: 'text-red-600' },
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5 page-fade">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('profile.title')}</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{t('profile.subtitle')}</p>
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
      <Section title={t('profile.profileDetails')} icon={User}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              {t('profile.displayName')}
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
              {updateProfile.isPending ? t('common.loading') : t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </Section>

      {/* Timezone */}
      <Section title={t('profile.timezoneLocale')} icon={Globe}>
        <div className="space-y-5">
          {/* Timezone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              {t('profile.timezone')}
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
              {t('profile.currentTimezone')}: <strong>{getCurrentTimezone()}</strong>
            </p>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              {t('profile.language')}
            </label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                    i18n.language === l.code
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm'
                      : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-base leading-none">{l.flag}</span>
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={() => updateProfile.mutate({ name, timezone })}
              disabled={updateProfile.isPending}
            >
              {t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </Section>

      {/* Appearance */}
      <Section title={t('profile.appearance')} icon={Palette}>
        <div className="flex gap-3">
          {[
            { value: 'system', Icon: Monitor, label: t('profile.themeSystem'), desc: t('profile.themeSystemDesc') },
            { value: 'light',  Icon: Sun,     label: t('profile.themeLight'),  desc: t('profile.themeLightDesc')  },
            { value: 'dark',   Icon: Moon,    label: t('profile.themeDark'),   desc: t('profile.themeDarkDesc')   },
          ].map(({ value, Icon, label, desc }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                theme === value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <Icon
                size={20}
                className={theme === value ? 'text-indigo-500' : 'text-gray-400 dark:text-slate-400'}
              />
              <span className={`text-sm font-semibold leading-tight ${theme === value ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-slate-300'}`}>
                {label}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-500 leading-tight">{desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Desktop notifications */}
      <Section title={t('notifications.desktop')} icon={Bell}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-slate-400">{t('notifications.desktopDesc')}</p>
          <div className="flex items-center gap-4">
            {notifStatus === 'unsupported' ? (
              <p className="text-sm text-amber-600 dark:text-amber-400">{t('notifications.notSupported')}</p>
            ) : notifStatus === 'denied' ? (
              <p className="text-sm text-red-500">{t('notifications.denied')}</p>
            ) : desktopNotif ? (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={15} /> {t('notifications.enabled')}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { disableDesktopNotifs(); setDesktopNotif(false); }}
                >
                  {t('common.disable')}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={async () => {
                  const result = await requestDesktopNotifPermission();
                  if (result === 'granted') setDesktopNotif(true);
                  else setNotifStatus(result);
                }}
              >
                <Bell size={13} /> {t('notifications.enable')}
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* Change password */}
      <Section title={t('profile.changePassword')} icon={Lock}>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
              Current Password
            </label>
            <Input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Your current password"
              autoComplete="current-password"
            />
          </div>
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
              placeholder="Repeat new password"
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

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-red-100 dark:border-red-900/30">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="font-bold text-red-600 dark:text-red-400 text-sm">Danger Zone</h3>
        </div>
        <div className="space-y-4">

          {/* Export data */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Export My Data</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Download all your tasks, comments and profile as JSON.
              </p>
            </div>
            <Button variant="secondary" onClick={handleExportData} className="shrink-0 flex items-center gap-1.5">
              <Download size={14} /> Export
            </Button>
          </div>

          {/* Delete account */}
          <div className="pt-3 border-t border-red-100 dark:border-red-900/30">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Delete Account</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">
              Permanently deletes your account and all associated data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Input
                value={deleteConfirm}
                onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
                placeholder='Type DELETE to confirm'
                className="max-w-xs"
              />
              <Button
                variant="danger"
                disabled={deleteConfirm !== 'DELETE' || deleteAccount.isPending}
                onClick={() => deleteAccount.mutate()}
                className="shrink-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 size={14} />
                {deleteAccount.isPending ? 'Deleting…' : 'Delete Account'}
              </Button>
            </div>
            {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
