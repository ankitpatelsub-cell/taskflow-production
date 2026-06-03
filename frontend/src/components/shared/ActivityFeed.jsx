import { formatDate } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { Plus, Edit3, Trash2, CheckCircle2, ArrowRight, Tag, Clock, Link2, MessageSquare } from 'lucide-react';

const STATUS_LABEL = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

function formatAction(action, oldVal, newVal) {
  const old = typeof oldVal === 'string' ? (() => { try { return JSON.parse(oldVal); } catch { return null; } })() : oldVal;
  const nw  = typeof newVal === 'string' ? (() => { try { return JSON.parse(newVal); } catch { return null; } })() : newVal;

  if (action === 'created') return { text: 'created this task', icon: Plus };
  if (action === 'deleted') return { text: 'deleted this task', icon: Trash2 };

  if (action === 'updated') {
    if (nw?.status && old?.status !== nw.status) {
      return {
        text: `changed status to ${STATUS_LABEL[nw.status] || nw.status}`,
        icon: ArrowRight,
        detail: old?.status ? `from ${STATUS_LABEL[old.status] || old.status}` : null,
      };
    }
    if (nw?.priority && old?.priority !== nw.priority) {
      return {
        text: `changed priority to ${PRIORITY_LABEL[nw.priority] || nw.priority}`,
        icon: Edit3,
        detail: old?.priority ? `from ${PRIORITY_LABEL[old.priority] || old.priority}` : null,
      };
    }
    if (nw?.title) return { text: `renamed task`, icon: Edit3, detail: nw.title };
    if (nw?.deadline !== undefined) return { text: nw.deadline ? `set deadline to ${nw.deadline}` : 'removed deadline', icon: Clock };
    if (nw?.assignee_id !== undefined) return { text: 'changed assignee', icon: CheckCircle2 };
    if (nw?.description !== undefined) return { text: 'updated description', icon: Edit3 };
    return { text: 'updated task', icon: Edit3 };
  }

  if (action === 'comment added') return { text: 'added a comment', icon: MessageSquare };
  if (action === 'tag added')     return { text: 'added a tag', icon: Tag };
  if (action === 'tag removed')   return { text: 'removed a tag', icon: Tag };
  if (action === 'link added')    return { text: 'added a link', icon: Link2 };
  if (action === 'link removed')  return { text: 'removed a link', icon: Link2 };
  if (action === 'time logged')   return { text: 'logged time', icon: Clock };

  return { text: action, icon: Edit3 };
}

const ACTION_ICON_COLOR = {
  Plus: 'text-emerald-500',
  Trash2: 'text-red-500',
  ArrowRight: 'text-blue-500',
  Edit3: 'text-gray-500',
  CheckCircle2: 'text-indigo-500',
  Clock: 'text-amber-500',
  Tag: 'text-purple-500',
  Link2: 'text-blue-400',
  MessageSquare: 'text-teal-500',
};

export function ActivityFeed({ items = [] }) {
  if (!items.length) {
    return (
      <div className="text-center py-8">
        <Clock size={24} className="mx-auto mb-2 text-gray-200 dark:text-slate-600" />
        <p className="text-sm text-gray-400 dark:text-slate-500">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gray-100 dark:bg-slate-700" />

      <div className="space-y-4">
        {items.map((item) => {
          const { text, icon: Icon, detail } = formatAction(item.action, item.old_value, item.new_value);
          const iconName = Icon.displayName || Icon.name || '';
          const iconColor = ACTION_ICON_COLOR[iconName] || 'text-gray-400';

          return (
            <div key={item.id} className="flex gap-3 relative">
              {/* Icon bubble */}
              <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-sm z-10">
                <Icon size={14} className={iconColor} />
              </div>

              <div className="flex-1 pt-1.5 min-w-0">
                <p className="text-sm text-gray-700 dark:text-slate-300">
                  <strong className="font-semibold text-gray-900 dark:text-white">{item.user_name || 'System'}</strong>
                  {' '}<span className="text-gray-600 dark:text-slate-400">{text}</span>
                  {detail && <span className="text-gray-400 dark:text-slate-500 text-xs ml-1">— {detail}</span>}
                </p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDate(item.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
