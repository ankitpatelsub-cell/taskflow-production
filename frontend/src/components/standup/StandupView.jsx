import { useState } from 'react';
import { useStandup } from '@/hooks/useStandup';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn, formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

function UserGroup({ group }) {
  const { user, tasks, stats } = group;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
        <Avatar name={user.name} src={user.avatar_url} />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{stats.total} tasks</span>
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{stats.done} done</span>
          {stats.overdue > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{stats.overdue} overdue</span>}
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {tasks.map((task) => (
          <div key={task.id} className={cn('px-4 py-3 flex items-start gap-3', task.is_overdue && 'bg-red-50/50')}>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5', STATUS_COLORS[task.status])}>
              {STATUS_LABELS[task.status]}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm text-gray-900', task.status === 'done' && 'line-through text-gray-400')}>{task.title}</p>
              {task.tags?.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {task.tags.map((t) => (
                    <span key={t.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: t.color + '33', color: t.color }}>{t.name}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <PriorityBadge priority={task.priority} />
              {task.deadline && (
                <span className={cn('text-xs flex items-center gap-1', task.is_overdue ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  <Calendar size={12} />{formatDate(task.deadline)}
                  {task.is_overdue && ' (overdue)'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StandupView({ projectId }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('');
  const { data, isLoading } = useStandup(projectId, { date, status: status || undefined });
  const [copied, setCopied] = useState(false);

  function copyToClipboard() {
    if (!data) return;
    const lines = [`Daily Standup — ${data.date}`, ''];
    data.groups.forEach(({ user, tasks, stats }) => {
      lines.push(`**${user.name}** (${stats.done}/${stats.total} done${stats.overdue ? `, ${stats.overdue} overdue` : ''})`);
      tasks.forEach((t) => {
        const overdue = t.is_overdue ? ' [OVERDUE]' : '';
        lines.push(`  - [${STATUS_LABELS[t.status]}] ${t.title}${overdue}`);
      });
      lines.push('');
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Standup</h2>
          <p className="text-sm text-gray-500 mt-0.5">Task summary grouped by team member</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
          >
            <option value="">All statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          <Button size="sm" variant="secondary" onClick={copyToClipboard}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {data?.groups?.length === 0 && <p className="text-center text-gray-400 py-12">No assigned tasks for this date.</p>}
          {data?.groups?.map((g) => <UserGroup key={g.user.id} group={g} />)}
          {data?.unassigned?.length > 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="font-semibold text-gray-500 text-sm">Unassigned Tasks ({data.unassigned.length})</p>
              </div>
              <div className="divide-y divide-gray-50">
                {data.unassigned.map((t) => (
                  <div key={t.id} className="px-4 py-3 text-sm text-gray-700">{t.title}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
