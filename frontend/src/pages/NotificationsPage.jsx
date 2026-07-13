import { useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Bell, CheckCheck, Info, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

function notifIcon(message) {
  if (/assigned/i.test(message))  return <CheckCircle2 size={15} className="text-indigo-500 shrink-0 mt-0.5" />;
  if (/comment/i.test(message))   return <MessageSquare size={15} className="text-blue-500 shrink-0 mt-0.5" />;
  if (/overdue|urgent/i.test(message)) return <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />;
  return <Info size={15} className="text-gray-400 shrink-0 mt-0.5" />;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

export function NotificationsPage() {
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const unread = notifications.filter((n) => !n.is_read);
  const read   = notifications.filter((n) => n.is_read);

  return (
    <div className="p-6 max-w-2xl mx-auto page-fade">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bell size={20} className="text-indigo-500" />
            Notifications
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {unreadCount > 0
              ? <span className="font-semibold text-indigo-600 dark:text-indigo-400">{unreadCount} unread</span>
              : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            <CheckCheck size={14} /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm py-16 text-center">
          <Bell size={40} className="mx-auto text-gray-200 dark:text-slate-600 mb-3" />
          <p className="font-medium text-gray-500 dark:text-slate-400">No notifications yet</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">You'll see assignment updates, comments, and reminders here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {unread.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">New</p>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700 shadow-sm overflow-hidden">
                {unread.map((n) => (
                  <NotifRow key={n.id} n={n} onRead={() => markOne.mutate(n.id)} />
                ))}
              </div>
            </div>
          )}

          {read.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Earlier</p>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700 overflow-hidden opacity-75">
                {read.map((n) => (
                  <NotifRow key={n.id} n={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotifRow({ n, onRead }) {
  return (
    <div
      onClick={onRead}
      className={cn(
        'px-4 py-3.5 flex items-start gap-3 transition-colors',
        !n.is_read ? 'cursor-pointer hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 bg-indigo-50/20 dark:bg-indigo-900/5' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
      )}
    >
      {notifIcon(n.message)}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', n.is_read ? 'text-gray-600 dark:text-slate-400' : 'text-gray-800 dark:text-white font-medium')}>
          {n.message}
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && (
        <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
      )}
    </div>
  );
}
