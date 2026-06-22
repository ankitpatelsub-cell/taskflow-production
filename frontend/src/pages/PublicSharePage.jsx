import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Eye, AlertCircle } from 'lucide-react';

// ── Public API call (no auth header needed) ───────────────────────────────────
function fetchShare(token) {
  // Use raw fetch so we bypass the auth interceptor
  return fetch(`/api/share/${token}`).then((res) => {
    if (!res.ok) throw new Error('not_found');
    return res.json();
  });
}

// ── Status icon ───────────────────────────────────────────────────────────────
function StatusIcon({ status }) {
  if (status === 'done')        return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === 'in_progress') return <Clock        size={14} className="text-blue-500  shrink-0" />;
  if (status === 'review')      return <Eye          size={14} className="text-purple-500 shrink-0" />;
  return <Circle size={14} className="text-gray-400 shrink-0" />;
}

// ── Single task row ───────────────────────────────────────────────────────────
function TaskRow({ task }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <StatusIcon status={task.status} />
      <span className="flex-1 text-sm text-gray-800 leading-snug">{task.title}</span>
      {task.assignee_name && (
        <span className="text-xs text-gray-400 hidden sm:block shrink-0">{task.assignee_name}</span>
      )}
      {task.due_date && (
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      )}
    </div>
  );
}

// ── Status column group ───────────────────────────────────────────────────────
function StatusGroup({ status, tasks }) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[status])}>
          {STATUS_LABELS[status] ?? status}
        </span>
        <span className="text-xs text-gray-400 font-medium">{tasks.length}</span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
      </div>
    </div>
  );
}

// ── Stat badge ────────────────────────────────────────────────────────────────
function StatBadge({ label, count, colorClass }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-2xl font-black', colorClass)}>{count}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function PublicSharePage() {
  const { token } = useParams({ strict: false });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['share', token],
    queryFn: () => fetchShare(token),
    retry: false,
    staleTime: 60_000,
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="space-y-3 w-full max-w-lg px-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Error / invalid token ─────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="inline-flex w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-5">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Link unavailable</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              This project is not shared or the link has expired. Ask the project owner to share it again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Group tasks by status in a defined order ──────────────────────────────
  const tasks  = data.tasks ?? [];
  const order  = ['todo', 'in_progress', 'review', 'done'];
  const groups = order.map((s) => ({ status: s, tasks: tasks.filter((t) => t.status === s) }));

  const total    = tasks.length;
  const done     = tasks.filter((t) => t.status === 'done').length;
  const inProg   = tasks.filter((t) => t.status === 'in_progress').length;
  const todo     = tasks.filter((t) => t.status === 'todo').length;
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        {/* Project title block */}
        <div className="mb-8">
          {data.project_color && (
            <div
              className="w-3 h-3 rounded-full inline-block mr-2 mb-0.5"
              style={{ backgroundColor: data.project_color }}
            />
          )}
          <h1 className="text-2xl font-black text-gray-900 inline">{data.project_name}</h1>
          {data.project_description && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{data.project_description}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <div className="flex items-center justify-around gap-4 flex-wrap">
            <StatBadge label="Total tasks"  count={total}  colorClass="text-gray-800" />
            <StatBadge label="To do"        count={todo}   colorClass="text-gray-500" />
            <StatBadge label="In progress"  count={inProg} colorClass="text-blue-600" />
            <StatBadge label="Done"         count={done}   colorClass="text-green-600" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-2xl font-black text-indigo-600">{pct}%</span>
              <span className="text-xs text-gray-500">Complete</span>
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Task list grouped by status */}
        {total === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Circle size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No tasks in this project yet.</p>
          </div>
        ) : (
          <div>
            {groups.map(({ status, tasks: gt }) => (
              <StatusGroup key={status} status={status} tasks={gt} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-5 text-center">
        <p className="text-xs text-gray-400">
          Shared via <span className="font-bold text-indigo-600">Tick</span> · Read-only view
        </p>
      </footer>
    </div>
  );
}

// ── Branded header ─────────────────────────────────────────────────────────────
function PublicHeader() {
  return (
    <header className="bg-white border-b border-gray-100 py-4 px-6">
      <div className="max-w-2xl mx-auto flex items-center gap-2">
        <span className="font-black text-xl text-indigo-600 tracking-tight">Tick</span>
        <span className="text-gray-300">·</span>
        <span className="text-sm text-gray-500">Shared project</span>
      </div>
    </header>
  );
}
