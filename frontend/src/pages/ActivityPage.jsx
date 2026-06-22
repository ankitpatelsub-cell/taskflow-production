import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Activity, User, Tag, Calendar, ArrowRight, Plus, Trash2, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useProject, useProjectMembers } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { cn, STATUS_LABELS } from '@/lib/utils';
import { formatTimeAgo } from '@/lib/utils';
import api from '@/lib/api';

const ACTION_META = {
  created:         { icon: Plus,        color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',  label: 'created' },
  updated:         { icon: ArrowRight,  color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',          label: 'updated' },
  deleted:         { icon: Trash2,      color: 'text-red-500 bg-red-50 dark:bg-red-900/20',             label: 'deleted' },
  commented:       { icon: MessageSquare, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20',  label: 'commented on' },
  status_changed:  { icon: CheckCircle2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',   label: 'changed status of' },
  assigned:        { icon: User,        color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',       label: 'assigned' },
};

function getActionMeta(action) {
  return ACTION_META[action] || { icon: Activity, color: 'text-gray-400 bg-gray-50 dark:bg-slate-700', label: action };
}

function ActivityDetail({ action, oldValue, newValue }) {
  if (!oldValue && !newValue) return null;

  if (action === 'status_changed' && newValue?.status) {
    return (
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {oldValue?.status && <><span className="line-through">{STATUS_LABELS[oldValue.status] || oldValue.status}</span> → </>}
        <span className="font-medium">{STATUS_LABELS[newValue.status] || newValue.status}</span>
      </span>
    );
  }

  if (action === 'updated' && newValue) {
    const changes = Object.keys(newValue).filter((k) => k !== 'updated_at');
    if (changes.length === 0) return null;
    return (
      <span className="text-xs text-gray-500 dark:text-slate-400">
        {changes.map((k) => k.replace(/_/g, ' ')).join(', ')}
      </span>
    );
  }

  return null;
}

function ActivityItem({ item, onOpenTask }) {
  const meta = getActionMeta(item.action);
  const Icon = meta.icon;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.color)}>
        <Icon size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {item.user_name || 'Someone'}
          </span>
          <span className="text-sm text-gray-500 dark:text-slate-400">{meta.label}</span>
          <button
            onClick={() => onOpenTask(item.entity_id)}
            className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-xs"
          >
            {item.task_title}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{formatTimeAgo(item.created_at)}</span>
          <ActivityDetail action={item.action} oldValue={item.old_value} newValue={item.new_value} />
        </div>
      </div>
    </div>
  );
}

export function ActivityPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['project-activity', projectId, filterUser, filterAction],
    queryFn: ({ pageParam = 0 }) =>
      api.get(`/projects/${projectId}/activity`, {
        params: { limit: 30, offset: pageParam, user_id: filterUser || undefined, action: filterAction || undefined },
      }).then((r) => r.data),
    getNextPageParam: (lastPage, allPages) => lastPage.length === 30 ? allPages.flat().length : undefined,
    enabled: !!projectId,
  });

  const items = data?.pages.flat() || [];

  function handleOpenTask(taskId) {
    setActiveProject(projectId);
    openTaskDrawer(taskId);
  }

  // Group by date
  const grouped = [];
  let lastDate = null;
  for (const item of items) {
    const date = new Date(item.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    if (date !== lastDate) {
      grouped.push({ type: 'date', label: date });
      lastDate = date;
    }
    grouped.push({ type: 'item', item });
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Activity</h2>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All members</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="status_changed">Status changed</option>
                <option value="commented">Commented</option>
                <option value="assigned">Assigned</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">{[1,2,3,4,5].map((i) => <div key={i} className="h-14 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Activity size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No activity yet</p>
              <p className="text-sm mt-1">Task changes, comments, and status updates will appear here</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 px-5 divide-y divide-gray-50 dark:divide-slate-700/50">
              {grouped.map((g, i) =>
                g.type === 'date' ? (
                  <div key={`d${i}`} className="py-2 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{g.label}</span>
                  </div>
                ) : (
                  <ActivityItem key={g.item.id} item={g.item} onOpenTask={handleOpenTask} />
                )
              )}
            </div>
          )}

          {hasNextPage && (
            <div className="mt-4 text-center">
              <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
