import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { Avatar } from '@/components/ui/Avatar';
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Clock, Users, CheckSquare } from 'lucide-react';

function fmtMins(m) {
  const mins = parseInt(m, 10) || 0;
  if (mins === 0) return '0h';
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h > 0 ? `${h}h ${r > 0 ? r + 'm' : ''}`.trim() : `${r}m`;
}

export function TimeReportPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data, isLoading } = useQuery({
    queryKey: ['time-report', projectId],
    queryFn: () => api.get(`/projects/${projectId}/time-report`).then(r => r.data),
    enabled: !!projectId,
  });

  const byTask = data?.byTask || [];
  const byUser = data?.byUser || [];

  const totalMinutes = byUser.reduce((s, u) => s + (parseInt(u.total_minutes, 10) || 0), 0);
  const tasksWithTime = byTask.filter(t => parseInt(t.total_minutes, 10) > 0);

  return (
    <div className="flex flex-col h-full">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto p-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total time logged', value: fmtMins(totalMinutes), icon: Clock, color: 'text-indigo-600' },
            { label: 'Tasks with time',   value: tasksWithTime.length,  icon: CheckSquare, color: 'text-emerald-600' },
            { label: 'Team members',      value: byUser.filter(u => parseInt(u.total_minutes,10) > 0).length, icon: Users, color: 'text-blue-600' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-3">
              <Icon size={20} className={cn('shrink-0', color)} />
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* By team member */}
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-3 text-sm">By Team Member</h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              {isLoading ? (
                <div className="space-y-2 p-4">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : byUser.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No time logged yet</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {byUser.map(u => {
                    const mins = parseInt(u.total_minutes, 10) || 0;
                    const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
                    return (
                      <div key={u.id} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-1.5">
                          <Avatar name={u.name} src={u.avatar_url} size="sm" />
                          <span className="text-sm font-medium text-gray-800 dark:text-slate-200 flex-1">{u.name}</span>
                          <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{fmtMins(mins)}</span>
                          <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* By task */}
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white mb-3 text-sm">By Task (Top logged)</h3>
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
              {isLoading ? (
                <div className="space-y-2 p-4">{[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}</div>
              ) : tasksWithTime.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No time logged on tasks yet</p>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {tasksWithTime.slice(0, 15).map(t => {
                    const mins = parseInt(t.total_minutes, 10) || 0;
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_COLORS[t.status])}>
                          {STATUS_LABELS[t.status]}
                        </span>
                        <span className="flex-1 text-sm text-gray-700 dark:text-slate-300 truncate">{t.title}</span>
                        <span className="text-sm font-bold text-gray-600 dark:text-slate-300 shrink-0">{fmtMins(mins)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
