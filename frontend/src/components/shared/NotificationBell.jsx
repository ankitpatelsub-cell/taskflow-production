import { Bell, CheckCheck, MessageSquare, UserCheck, AlertTriangle, Clock } from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function notifIcon(message) {
  const m = (message || '').toLowerCase();
  if (m.includes('comment'))   return { icon: MessageSquare, color: 'text-teal-500 bg-teal-50' };
  if (m.includes('assign'))    return { icon: UserCheck,     color: 'text-indigo-500 bg-indigo-50' };
  if (m.includes('overdue'))   return { icon: AlertTriangle, color: 'text-red-500 bg-red-50' };
  if (m.includes('deadline'))  return { icon: Clock,         color: 'text-amber-500 bg-amber-50' };
  return { icon: Bell, color: 'text-gray-400 bg-gray-100' };
}

export function NotificationBell() {
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const unread = data?.unread_count || 0;
  const notifications = data?.notifications || [];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="relative p-1.5 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title="Notifications"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl w-80 max-h-[420px] overflow-y-auto z-50"
          align="end"
          sideOffset={8}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">Notifications</p>
              {unread > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell size={24} className="mx-auto mb-2 text-gray-200 dark:text-slate-600" />
              <p className="text-sm text-gray-400 dark:text-slate-500">All caught up!</p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => {
                const { icon: Icon, color } = notifIcon(n.message);
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markOne.mutate(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-slate-700/50 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
                      !n.is_read ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : ''
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-slate-200 leading-snug">{n.message}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5" title={new Date(n.created_at).toLocaleString()}>
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 bg-indigo-500 rounded-full shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
