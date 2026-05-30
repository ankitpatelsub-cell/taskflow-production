import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

export function ActivityFeed({ items = [] }) {
  if (!items.length) return <p className="text-sm text-gray-400 text-center py-6">No activity yet</p>;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 text-sm">
          <Avatar name={item.user_name || 'System'} size="sm" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-gray-700">
              <strong>{item.user_name || 'System'}</strong>{' '}
              <span className="text-gray-500">{item.action}</span>
            </p>
            <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
