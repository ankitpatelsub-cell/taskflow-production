import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getGroupedTimezones, getCurrentTimezone } from '@/lib/timezones';
import { CheckCircle2, User, Globe, Lock, Trash2, Download, AlertTriangle, Bell, Palette, Monitor, Sun, Moon, ShieldCheck, Key, Copy, Plus, Eye, EyeOff } from 'lucide-react';
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings';
import { useTranslation } from 'react-i18next';
import { setLanguage, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import {
  getDesktopNotifEnabled,
  requestDesktopNotifPermission,
  disableDesktopNotifs,
} from '@/hooks/useDesktopNotifications';
import { useThemeStore } from '@/stores/themeStore';
import { toast } from '@/components/ui/Toast';

const grouped = getGroupedTimezones();

function ApiKeysSection() {
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState('read');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState(null); // { id, key }

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/me/api-keys').then((r) => r.data),
  });

  const createKey = useMutation({
    mutationFn: (body) => api.post('/me/api-keys', body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      setRevealedKey({ id: data.id, key: data.key });
      setNewKeyName(''); setNewKeyScopes('read'); setNewKeyExpiry('');
      setShowCreate(false);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create API key'),
  });

  const deleteKey = useMutation({
    mutationFn: (id) => api.delete(`/me/api-keys/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['api-keys'] });
      if (revealedKey?.id === id) setRevealedKey(null);
      toast.success('API key revoked');
    },
    onError: () => toast.error('Failed to revoke API key'),
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Key size={18} className="text-indigo-500" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">API Keys</h3>
          <span className="text-xs text-gray-400">({keys.length}/10)</span>
        </div>
        {!showCreate && keys.length < 10 && (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New key
          </Button>
        )}
      </div>

      {revealedKey && (
        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
            Copy your API key now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 font-mono break-all text-gray-800 dark:text-gray-200">
              {revealedKey.key}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(revealedKey.key); toast.success('Copied!'); }}
              className="p-2 rounded-lg text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
              title="Copy"
            >
              <Copy size={15} />
            </button>
          </div>
          <button
            onClick={() => setRevealedKey(null)}
            className="mt-2 text-xs text-amber-600 hover:underline"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {showCreate && (
        <form
          className="mb-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            createKey.mutate({
              name: newKeyName,
              scopes: newKeyScopes,
              expires_days: newKeyExpiry ? Number(newKeyExpiry) : undefined,
            });
          }}
        >
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Key name *</label>
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g. CI deploy script" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Scopes</label>
              <select
                value={newKeyScopes}
                onChange={(e) => setNewKeyScopes(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="read">read</option>
                <option value="read,write">read + write</option>
                <option value="read,write,admin">read + write + admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-slate-300 mb-1">Expires in (days)</label>
              <Input
                type="number"
                min="1"
                max="365"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
                placeholder="Never"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="flex-1" disabled={!newKeyName.trim() || createKey.isPending}>
              {createKey.isPending ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-12 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}</div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No API keys yet. Create one to access the REST API.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => {
            const expired = k.expires_at && new Date(k.expires_at) < new Date();
            return (
              <div key={k.id} className={`flex items-center gap-3 p-3 rounded-xl border ${expired ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-100 dark:border-slate-700'}`}>
                <Key size={14} className={expired ? 'text-red-400' : 'text-gray-400'} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{k.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{k.key_prefix}… · {k.scopes}
                    {k.expires_at && <span className={expired ? ' text-red-500' : ''}> · {expired ? 'expired' : `expires ${new Date(k.expires_at).toLocaleDateString()}`}</span>}
                    {k.last_used_at && <span> · last used {new Date(k.last_used_at).toLocaleDateString()}</span>}
                  </p>
                </div>
                <button
                  onClick={() => { if (!confirm(`Revoke "${k.name}"?`)) return; deleteKey.mutate(k.id); }}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded"
                  title="Revoke key"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        <p className="text-xs text-gray-400">
          Use your API key as a Bearer token: <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">Authorization: Bearer tick_xxx</code>
        </p>
      </div>
    </div>
  );
}

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
    onError: () => setDeleteError(t('profile.deleteError')),
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
    success:      { text: t('profile.pwChanged'),      cls: 'text-emerald-600' },
    mismatch:     { text: t('profile.pwMismatch'),     cls: 'text-red-600' },
    short:        { text: t('profile.pwTooShort'),     cls: 'text-red-600' },
    empty:        { text: t('profile.pwEmpty'),        cls: 'text-red-600' },
    nocurrent:    { text: t('profile.pwNoCurrent'),    cls: 'text-red-600' },
    wrongcurrent: { text: t('profile.pwWrongCurrent'), cls: 'text-red-600' },
    error:        { text: t('profile.pwError'),        cls: 'text-red-600' },
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
              {t('profile.emailAddress')}
            </label>
            <Input value={user?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-gray-400 mt-1">{t('profile.emailNote')}</p>
          </div>

          <div className="flex justify-between items-center pt-2">
            {saved && (
              <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <CheckCircle2 size={15} /> {t('profile.saved')}
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
              {t('profile.currentPassword')}
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
              {t('profile.newPassword')}
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
              {t('profile.confirmPassword')}
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
              {changePassword.isPending ? t('profile.changing') : t('profile.changePasswordBtn')}
            </Button>
          </div>
        </form>
      </Section>

      {/* Two-Factor Authentication */}
      <Section title="Two-Factor Authentication" icon={ShieldCheck}>
        <TwoFactorSettings />
      </Section>

      {/* API Keys */}
      <ApiKeysSection />

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-red-100 dark:border-red-900/30">
          <AlertTriangle size={18} className="text-red-500" />
          <h3 className="font-bold text-red-600 dark:text-red-400 text-sm">{t('profile.dangerZone')}</h3>
        </div>
        <div className="space-y-4">

          {/* Export data */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">{t('profile.exportData')}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{t('profile.exportDesc')}</p>
            </div>
            <Button variant="secondary" onClick={handleExportData} className="shrink-0 flex items-center gap-1.5">
              <Download size={14} /> {t('common.export')}
            </Button>
          </div>

          {/* Delete account */}
          <div className="pt-3 border-t border-red-100 dark:border-red-900/30">
            <p className="text-sm font-semibold text-gray-800 dark:text-white">{t('profile.deleteAccount')}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 mb-3">{t('profile.deleteDesc')}</p>
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
                {deleteAccount.isPending ? t('profile.deleting') : t('profile.deleteAccount')}
              </Button>
            </div>
            {deleteError && <p className="text-xs text-red-600 mt-2">{deleteError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
