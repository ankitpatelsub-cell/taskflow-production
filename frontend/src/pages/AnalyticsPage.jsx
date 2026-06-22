import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  FolderKanban,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Users,
} from 'lucide-react';
import { usePortfolioAnalytics } from '@/hooks/useAnalytics';
import { cn, formatDate, formatTimeAgo } from '@/lib/utils';

// ── Skeleton helpers ──────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-100 dark:bg-slate-700',
        className
      )}
    />
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-4">
      {children}
    </h2>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, gradient, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm bg-gradient-to-br',
          gradient
        )}
      >
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Loading skeleton layout ───────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-pulse">
      {/* Summary row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 space-y-3 shadow-sm"
          >
            <Skeleton className="w-10 h-10 rounded-xl" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

// ── Task progress bar (reusable) ──────────────────────────────────────────────
function TaskProgressBar({ done = 0, total = 0, color = '#6366f1' }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-slate-400 shrink-0 tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

// ── Weekly trend chart ────────────────────────────────────────────────────────
function WeeklyTrendChart({ data = [] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
      <SectionTitle>Weekly Completion Trend</SectionTitle>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">
          No data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                fontSize: '12px',
              }}
              formatter={(v) => [v, 'Tasks completed']}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Overdue by project bar chart ──────────────────────────────────────────────
function OverdueByProjectChart({ data = [] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
      <SectionTitle>Overdue by Project</SectionTitle>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">
          No overdue tasks
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="project"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={data.length > 4 ? -30 : 0}
              textAnchor={data.length > 4 ? 'end' : 'middle'}
              height={data.length > 4 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '10px',
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                fontSize: '12px',
              }}
              formatter={(v) => [v, 'Overdue tasks']}
            />
            <Bar dataKey="overdue" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Projects health list ──────────────────────────────────────────────────────
function ProjectsHealthSection({ projects = [] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
      <SectionTitle>Project Health</SectionTitle>
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
          <FolderKanban size={32} className="mb-2 opacity-40" />
          <p className="text-sm">No projects yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color || '#6366f1' }}
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {p.name}
                  </span>
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0" title={p.last_activity ? formatDate(p.last_activity) : undefined}>
                  {p.last_activity ? formatTimeAgo(p.last_activity) : 'No activity'}
                </span>
              </div>
              <TaskProgressBar
                done={p.done_tasks ?? 0}
                total={p.total_tasks ?? 0}
                color={p.color || '#6366f1'}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Team performance section ──────────────────────────────────────────────────
function TeamPerformanceSection({ members = [] }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm">
      <SectionTitle>Team Performance (Last 30 days)</SectionTitle>
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-slate-500">
          <Users size={32} className="mb-2 opacity-40" />
          <p className="text-sm">No team data yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {members.map((m, i) => {
            const initials = m.name
              ? m.name
                  .split(' ')
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
              : '?';
            return (
              <div
                key={m.id ?? i}
                className="flex items-center gap-3"
              >
                {/* Avatar */}
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt={m.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xs font-bold shrink-0">
                    {initials}
                  </div>
                )}
                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {m.name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {m.tasks_completed ?? 0} tasks done
                    {m.time_logged_hours != null &&
                      ` · ${m.time_logged_hours}h logged`}
                  </p>
                </div>
                {/* Tasks done badge */}
                <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  {m.tasks_completed ?? 0}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty state (no projects at all) ─────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-6xl mb-4">📊</div>
      <h2 className="text-xl font-bold text-gray-700 dark:text-white mb-2">
        No analytics yet
      </h2>
      <p className="text-sm text-gray-400 dark:text-slate-400 max-w-sm">
        Create some projects and tasks to start seeing portfolio analytics here.
      </p>
    </div>
  );
}

// ── AnalyticsPage ─────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = usePortfolioAnalytics();

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle size={18} className="text-red-500 shrink-0" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex-1">
            Failed to load analytics. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm font-semibold text-red-700 dark:text-red-400 underline hover:no-underline shrink-0"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const totalProjects = data?.total_projects ?? 0;

  if (totalProjects === 0 && !isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Portfolio-wide performance overview
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const summary = [
    {
      icon: FolderKanban,
      label: 'Total Projects',
      value: data?.total_projects ?? 0,
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      icon: CheckCircle2,
      label: 'Total Tasks',
      value: data?.total_tasks ?? 0,
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: TrendingUp,
      label: 'Completion Rate',
      value: `${data?.completion_rate ?? 0}%`,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: AlertTriangle,
      label: 'Overdue Tasks',
      value: data?.overdue_tasks ?? 0,
      gradient:
        (data?.overdue_tasks ?? 0) > 0
          ? 'from-red-500 to-red-600'
          : 'from-gray-400 to-gray-500',
    },
    {
      icon: Zap,
      label: 'On-Time Sprint Rate',
      value: `${data?.on_time_sprint_rate ?? 0}%`,
      gradient: 'from-amber-400 to-amber-500',
    },
  ];

  const weeklyTrend = data?.weekly_trend ?? [];
  const projectsHealth = data?.projects_health ?? [];
  const teamPerformance = data?.team_performance ?? [];
  const overdueByProject = data?.overdue_by_project ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          Portfolio-wide performance overview
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {summary.map(({ icon, label, value, gradient }) => (
          <StatCard key={label} icon={icon} label={label} value={value} gradient={gradient} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WeeklyTrendChart data={weeklyTrend} />
        <OverdueByProjectChart data={overdueByProject} />
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectsHealthSection projects={projectsHealth} />
        <TeamPerformanceSection members={teamPerformance} />
      </div>
    </div>
  );
}
