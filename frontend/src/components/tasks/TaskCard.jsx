import { Calendar, MessageSquare, Paperclip, AlertTriangle, RefreshCw } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

export function TaskCard({ task, projectId, dragHandleProps = {} }) {
  const { openTaskDrawer, setActiveProject } = useUiStore();

  function open() {
    setActiveProject(projectId);
    openTaskDrawer(task.id);
  }

  const overdue = task.deadline && isOverdue(task.deadline) && task.status !== 'done';
  const done = task.status === 'done';
  const incomplete = !done && (!task.assignee_id || !task.deadline);

  return (
    <div
      onClick={open}
      className={cn(
        'bg-white rounded-xl p-3.5 cursor-pointer transition-all select-none',
        'border shadow-sm hover:shadow-md',
        overdue ? 'border-red-200 hover:border-red-300' : incomplete ? 'border-amber-200 hover:border-amber-300' : 'border-gray-100 hover:border-indigo-200',
        done && 'opacity-60'
      )}
      {...dragHandleProps}
    >
      {/* Title */}
      <p className={cn('text-sm font-medium text-gray-800 mb-2 line-clamp-2 leading-snug', done && 'line-through text-gray-400')}>
        {task.title}
      </p>

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {task.tags.map((t) => (
            <span
              key={t.id}
              className="text-xs px-1.5 py-0.5 rounded-md font-medium"
              style={{ backgroundColor: t.color + '20', color: t.color, border: `1px solid ${t.color}30` }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <div className="flex items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {task.recurrence_rule && (
            <span
              title={`Repeats ${task.recurrence_rule}${task.recurrence_interval > 1 ? ` every ${task.recurrence_interval}` : ''}`}
              className="flex items-center gap-0.5 text-[10px] font-semibold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700"
            >
              <RefreshCw size={9} />
              {task.recurrence_rule}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {incomplete && (
            <span title={`Missing: ${[!task.assignee_id && 'assignee', !task.deadline && 'deadline'].filter(Boolean).join(', ')}`}>
              <AlertTriangle size={12} className="text-amber-400" />
            </span>
          )}
          {/* Meta icons */}
          <div className="flex items-center gap-1.5 text-gray-300">
            {(task.comments?.length > 0 || task.comment_count > 0) && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <MessageSquare size={11} />
                {task.comments?.length || task.comment_count}
              </span>
            )}
            {(task.attachments?.length > 0) && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <Paperclip size={11} />
                {task.attachments.length}
              </span>
            )}
          </div>

          {/* Deadline */}
          {task.deadline && (
            <span className={cn(
              'flex items-center gap-1 text-xs rounded-md px-1.5 py-0.5',
              overdue
                ? 'bg-red-50 text-red-600 font-semibold'
                : 'text-gray-400'
            )}>
              <Calendar size={11} />
              {formatDate(task.deadline)}
            </span>
          )}

          {/* Assignee */}
          {task.assignee_name && (
            <Avatar name={task.assignee_name} src={task.assignee_avatar} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}

