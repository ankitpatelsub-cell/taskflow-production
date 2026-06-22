import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { Avatar } from '@/components/ui/Avatar';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils';
import { AlertTriangle, Clock, CheckCircle2, TrendingUp, ChevronDown, ChevronRight, Calendar } from 'lucide-react';

const PRIORITY_DOT = {
  low:      'bg-gray-400',
  medium:   'bg-blue-500',
  high:     'bg-orange-500',
  critical: 'bg-red-600',
};

const STATUS_BG = {
  todo:        'bg-gray-200',
  in_progress: 'bg-blue-500',
  review:      'bg-amber-400',
  done:        'bg-emerald-500',
};

function WorkloadBar({ active, done }) {
  const total = active + done;
  if (!total) return <div className="h-2 bg-gray-100 rounded-full" />;
  const donePct = Math.round((done / total) * 100);
  return (
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${donePct}%` }} />
    </div>
  );
}

function overloadLevel(active, overdue) {
  if (overdue > 0 || active > 10) return 'critical';
  if (active > 6) return 'warning';
  return 'ok';
}

const LEVEL_BADGE = {
  ok:       'bg-emerald-100 text-emerald-700',
  warning:  'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};
const LEVEL_LABEL = { ok: 'Healthy', warning: 'Busy', critical: 'Overloaded' };

export function WorkloadPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workload', projectId],
    queryFn: () => api.get(`/projects/${projectId}/workload`).then(r => r.data),
    enabled: !!projectId,
  });

  const [expanded, setExpanded] = useState(new Set());
  const [drawerTaskId, setDrawerTaskId] = useState(null);

  const totalActive = members.reduce((s, m) => s + (m.active_tasks || 0), 0);
  const totalDone   = members.reduce((s, m) => s + (m.done_tasks || 0), 0);

  function toggleExpand(memberId) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto p-6">
        {/* Summary bar */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active tasks', value: totalActive, icon: TrendingUp, color: 'text-blue-600' },
            { label: 'Completed',    value: totalDone,   icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Team members', value: members.length, icon: Clock, color: 'text-indigo-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
              <Icon size={20} className={cn('shrink-0', color)} />
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Member cards */}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
        ) : members.length === 0 ? (
          <p className="text-center text-gray-400 py-12">No team members found.</p>
        ) : (
          <div className="space-y-3">
            {members.map(m => {
              const level = overloadLevel(m.active_tasks, m.overdue_tasks);
              const isExpanded = expanded.has(m.id);
              return (
                <div key={m.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
                  {/* Clickable header */}
                  <div
                    className="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    onClick={() => toggleExpand(m.id)}
                  >
                    <div className="flex items-start gap-4">
                      <Avatar name={m.name} src={m.avatar_url} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-900 dark:text-white">{m.name}</p>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', LEVEL_BADGE[level])}>
                            {LEVEL_LABEL[level]}
                          </span>
                          {m.overdue_tasks > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                              <AlertTriangle size={11} /> {m.overdue_tasks} overdue
                            </span>
                          )}
                          <div className="ml-auto flex items-center text-gray-400">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </div>
                        </div>

                        <WorkloadBar active={m.active_tasks} done={m.done_tasks} />

                        <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-slate-400">
                          <span>{m.active_tasks} active</span>
                          <span>{m.done_tasks} done</span>
                          {m.estimated_hours_remaining > 0 && (
                            <span>{m.estimated_hours_remaining.toFixed(1)}h estimated</span>
                          )}
                          {m.logged_minutes > 0 && (
                            <span>{Math.round(m.logged_minutes / 60)}h logged</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {['todo', 'in_progress', 'review'].map(s => {
                            const count = m[`${s}_tasks`] || 0;
                            if (!count) return null;
                            return (
                              <span key={s} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                                <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_BG[s])} />
                                {count} {s.replace('_', ' ')}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded task list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-700">
                      {m.top_tasks?.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No active tasks</p>
                      ) : (
                        <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                          {m.top_tasks?.map(t => (
                            <button
                              key={t.id}
                              onClick={(e) => { e.stopPropagation(); setDrawerTaskId(t.id); }}
                              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors text-left"
                            >
                              <span className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[t.priority])} />
                              <span className="flex-1 text-sm text-gray-800 dark:text-slate-200 truncate">{t.title}</span>
                              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[t.status])}>
                                {STATUS_LABELS[t.status]}
                              </span>
                              {t.deadline && (
                                <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                                  <Calendar size={11} />
                                  {t.deadline.slice(0, 10)}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                      {m.active_tasks > 5 && (
                        <p className="text-xs text-gray-400 text-center py-2">
                          Showing top 5 of {m.active_tasks} active tasks
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {drawerTaskId && (
        <TaskDetailDrawer
          projectId={projectId}
          taskId={drawerTaskId}
          onClose={() => setDrawerTaskId(null)}
        />
      )}
    </div>
  );
}
