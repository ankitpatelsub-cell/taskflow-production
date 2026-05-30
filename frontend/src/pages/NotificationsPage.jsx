import { useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Bell } from 'lucide-react';

export function NotificationsPage() {
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500">{data?.unread_count || 0} unread</p>
        </div>
        {data?.unread_count > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAll.mutate()}>Mark all read</Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {data?.notifications?.length === 0 && (
          <div className="py-12 text-center">
            <Bell size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">No notifications yet</p>
          </div>
        )}
        {data?.notifications?.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.is_read && markOne.mutate(n.id)}
            className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-indigo-50/40' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-gray-200' : 'bg-indigo-500'}`} />
              <div>
                <p className="text-sm text-gray-800">{n.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.created_at)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
