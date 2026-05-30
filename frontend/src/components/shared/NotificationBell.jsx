import { Bell } from 'lucide-react';
import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useNotifications, useMarkAllRead, useMarkRead } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/utils';

export function NotificationBell() {
  const { data } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const unread = data?.unread_count || 0;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="relative p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white border border-gray-200 rounded-xl shadow-xl w-80 max-h-96 overflow-y-auto z-50"
          align="end"
          sideOffset={8}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-sm text-gray-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {data?.notifications?.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications</p>
          )}
          {data?.notifications?.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markOne.mutate(n.id)}
              className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-indigo-50/50' : ''}`}
            >
              <p className="text-sm text-gray-800">{n.message}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(n.created_at)}</p>
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
