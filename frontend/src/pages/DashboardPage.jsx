import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from '@tanstack/react-router';
import { FolderKanban, CheckCircle2, Archive, Users, ArrowRight, ArchiveRestore, Plus, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAdminOrAbove } from '@/lib/roles';
import { CreateProjectModal } from '@/components/shared/CreateProjectModal';
import { cn, formatDate, isOverdue, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import api from '@/lib/api';
import { useTranslation } from 'react-i18next';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const { t } = useTranslation();

  const { data: myTasksData } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/users/me/tasks').then((r) => r.data),
    staleTime: 30_000,
  });

  const myTasks = myTasksData?.tasks ?? [];
  const overdueCount = myTasksData?.overdue_count ?? 0;

  const totalTasks = projects.reduce((s, p) => s + (p.task_count || 0), 0);
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const archivedProjects = projects.filter((p) => p.status === 'archived');
  const archivedCount = archivedProjects.length;

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.goodMorning');
    if (hour < 17) return t('dashboard.goodAfternoon');
    return t('dashboard.goodEvening');
  }

  const stats = [
    { labelKey: 'dashboard.statActiveProjects', value: activeProjectsCount, icon: FolderKanban,
      tint: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800', iconTint: 'bg-indigo-500' },
    { labelKey: 'dashboard.statTotalTasks',     value: totalTasks,          icon: CheckCircle2,
      tint: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800', iconTint: 'bg-emerald-500' },
    { labelKey: 'dashboard.statMyOpenTasks',    value: myTasks.length,      icon: Clock,
      tint: overdueCount > 0
        ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
        : 'bg-coral-50 dark:bg-coral-900/20 border-coral-100 dark:border-coral-800',
      iconTint: overdueCount > 0 ? 'bg-red-500' : 'bg-coral-500' },
    { labelKey: 'dashboard.statArchived',       value: archivedCount,       icon: Archive,
      tint: 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700', iconTint: 'bg-gray-400' },
  ];

  function openTask(task) {
    setActiveProject(task.project_id);
    openTaskDrawer(task.id);
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="relative">
      {/* Ambient background glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-200/40 dark:bg-indigo-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-24 w-80 h-80 bg-coral-200/40 dark:bg-coral-900/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-6 max-w-6xl mx-auto page-fade">
        {/* Hero greeting */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-indigo-400 to-coral-400 p-7 sm:p-8 mb-8 shadow-md">
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <p className="relative text-white/70 text-sm font-medium mb-1">{today}</p>
          <h2 className="relative text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0]}!
          </h2>
          <p className="relative text-white/80 mt-1.5 text-sm sm:text-base">{t('dashboard.overview')}</p>
          {overdueCount > 0 && (
            <div className="relative mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full">
              <AlertTriangle size={14} className="text-white shrink-0" />
              <p className="text-xs font-semibold text-white">
                {t('dashboard.overdueAlert', { count: overdueCount })}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
          {stats.map(({ labelKey, value, icon: Icon, tint, iconTint }) => (
            <div key={labelKey} className={`rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow ${tint}`}>
              <div className={`w-10 h-10 rounded-2xl ${iconTint} flex items-center justify-center mb-3 shadow-sm`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{t(labelKey)}</p>
            </div>
          ))}
        </div>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* My Tasks */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t('dashboard.myTasks')}</h3>
            <span className="text-sm text-gray-400">{t('dashboard.openCount', { count: myTasks.length })}</span>
          </div>
          <div className="space-y-2">
            {myTasks.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-8 text-center shadow-sm">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{t('dashboard.allCaughtUp')}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{t('dashboard.noOpenTasks')}</p>
              </div>
            ) : (
              myTasks.slice(0, 8).map((task) => {
                const overdue = task.deadline && isOverdue(task.deadline) && task.status !== 'done';
                return (
                  <div
                    key={task.id}
                    onClick={() => openTask(task)}
                    className={cn(
                      'bg-white dark:bg-slate-800 rounded-xl border p-3.5 cursor-pointer hover:shadow-md transition-all shadow-sm group',
                      overdue ? 'border-red-200 dark:border-red-800 hover:border-red-300' : 'border-gray-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-600'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: task.project_color }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400 dark:text-slate-500 truncate">{task.project_name}</span>
                          {task.deadline && (
                            <span className={cn('flex items-center gap-0.5 text-xs', overdue ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-slate-500')}>
                              <Calendar size={10} />
                              {formatDate(task.deadline)}
                              {overdue && (
                                <span className="ml-0.5 text-[10px] bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1 rounded-full font-bold">
                                  {t('dashboard.overdueBadge')}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded-full font-semibold', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            {myTasks.length > 8 && (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center pt-1">
                {t('dashboard.moreTasks', { count: myTasks.length - 8 })}
              </p>
            )}
          </div>
        </div>

        {/* Active Projects */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white">{t('dashboard.activeProjects')}</h3>
            <span className="text-sm text-gray-400">{t('dashboard.projectsCount', { count: activeProjectsCount })}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.filter((p) => p.status === 'active').map((p) => (
              <div
                key={p.id}
                onClick={() => navigate({ to: `/app/projects/${p.id}/board` })}
                className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 cursor-pointer hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-700 transition-all shadow-sm overflow-hidden"
                style={{ borderTop: `3px solid ${p.color}` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</p>
                  </div>
                  <ArrowRight size={15} className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </div>
                <p className="text-sm line-clamp-2 mb-4 min-h-[2.5rem]">
                  {p.description
                    ? <span className="text-gray-500 dark:text-slate-400">{p.description}</span>
                    : <span className="text-gray-300 dark:text-slate-600 italic">{t('dashboard.noDescription')}</span>
                  }
                </p>
                {p.task_count > 0 && (() => {
                  const pct = Math.round(((p.done_count || 0) / p.task_count) * 100);
                  return (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400 dark:text-slate-500">
                          {t('dashboard.doneTasks', { done: p.done_count || 0, total: p.task_count })}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: p.color }} />
                      </div>
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 pt-3 border-t border-gray-50 dark:border-slate-700">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={11} /> {t('dashboard.taskCountShort', { count: p.task_count })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={11} /> {t('dashboard.memberCountShort', { count: p.member_count })}
                  </span>
                </div>
              </div>
            ))}
            {projects.filter((p) => p.status === 'active').length === 0 && (
              <div className="col-span-2 text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <FolderKanban size={40} className="mx-auto mb-3 text-gray-200 dark:text-slate-600" />
                <p className="font-medium text-gray-500 dark:text-slate-400 mb-1">{t('dashboard.noProjects')}</p>
                {isAdminOrAbove(user?.role) ? (
                  <button
                    onClick={() => setShowCreateProject(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={15} /> {t('dashboard.createProject')}
                  </button>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-slate-500">{t('dashboard.askAdmin')}</p>
                )}
              </div>
            )}
            {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
          </div>
        </div>
      </div>

      {archivedCount > 0 && isAdminOrAbove(user?.role) && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors mb-3"
          >
            <Archive size={15} />
            {showArchived ? t('dashboard.hideArchived') : t('dashboard.showArchived')} ({archivedCount})
          </button>

          {showArchived && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archivedProjects.map((p) => (
                <ArchivedProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function ArchivedProjectCard({ project: p }) {
  const restore = useUpdateProject(p.id);
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl p-4 opacity-70">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
        style={{ backgroundColor: p.color }}
      >
        {p.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-700 dark:text-slate-300 truncate text-sm">{p.name}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{t('dashboard.taskCountShort', { count: p.task_count || 0 })}</p>
      </div>
      <button
        onClick={() => restore.mutate({ status: 'active' })}
        disabled={restore.isPending}
        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 rounded-lg transition-colors disabled:opacity-50"
        title={t('common.restore')}
      >
        <ArchiveRestore size={13} />
        {t('common.restore')}
      </button>
    </div>
  );
}
