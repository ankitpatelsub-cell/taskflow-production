import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Play, CheckCheck, Plus, X, CalendarDays, Target, ListChecks } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import {
  useSprint,
  useSprintBurndown,
  useStartSprint,
  useCompleteSprint,
  useAddTaskToSprint,
  useRemoveTaskFromSprint,
} from '@/hooks/useSprints';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { ProjectNav } from './ProjectNav';
import { cn, formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { hasMinRole } from '@/lib/roles';

// ── Status badge ──────────────────────────────────────────────────────────────
const SPRINT_STATUS_CONFIG = {
  planning:  { label: 'Planning',  class: 'bg-gray-100 text-gray-600' },
  active:    { label: 'Active',    class: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completed', class: 'bg-blue-100 text-blue-700' },
};

function SprintStatusBadge({ status }) {
  const cfg = SPRINT_STATUS_CONFIG[status] || SPRINT_STATUS_CONFIG.planning;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.class)}>
      {cfg.label}
    </span>
  );
}

// ── Burndown chart ────────────────────────────────────────────────────────────
function BurndownChart({ sprint, burndownData }) {
  // Build chart data: merge ideal line with actual data points
  const chartData = useMemo(() => {
    if (!sprint?.start_date || !sprint?.end_date) return [];

    const start  = new Date(sprint.start_date);
    const end    = new Date(sprint.end_date);
    const totalDays = Math.max(
      1,
      Math.round((end - start) / (1000 * 60 * 60 * 24))
    );

    // Build a lookup from date string → remaining tasks from API
    const actualMap = {};
    if (Array.isArray(burndownData)) {
      burndownData.forEach((pt) => {
        const key = pt.date ? pt.date.slice(0, 10) : null;
        if (key) actualMap[key] = pt.remaining ?? pt.remaining_tasks ?? null;
      });
    }

    // Determine total tasks for ideal line baseline
    const totalTasks =
      burndownData?.[0]?.total_tasks ??
      (sprint.tasks?.length ?? sprint.total_tasks ?? 0);

    const points = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const ideal = Math.round(totalTasks - (totalTasks / totalDays) * i);

      points.push({
        date: label,
        Ideal: ideal < 0 ? 0 : ideal,
        Actual: actualMap[dateStr] ?? null,
      });
    }

    return points;
  }, [sprint, burndownData]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        Set start and end dates to display the burndown chart.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 8, right: 24, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#A5917A' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#A5917A' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '10px',
            border: '1px solid #EDE5DA',
            fontSize: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
        />
        <Line
          type="linear"
          dataKey="Ideal"
          stroke="#CBB9A3"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="Actual"
          stroke="#7C6AE8"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#7C6AE8' }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Task row ──────────────────────────────────────────────────────────────────
function SprintTaskRow({ task, projectId, sprintId, canWrite, onOpen }) {
  const removeMutation = useRemoveTaskFromSprint(projectId, sprintId);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/30 cursor-pointer transition-colors group"
      onClick={() => onOpen(task.id)}
    >
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold shrink-0', STATUS_COLORS[task.status])}>
        {STATUS_LABELS[task.status]}
      </span>

      <span className={cn('flex-1 text-sm font-medium truncate', task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900')}>
        {task.title}
      </span>

      <span className="hidden sm:inline-flex shrink-0">
        <PriorityBadge priority={task.priority} />
      </span>

      {task.assignee_name ? (
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <Avatar name={task.assignee_name} size="sm" />
          <span className="text-xs text-gray-500 hidden sm:inline">{task.assignee_name}</span>
        </div>
      ) : (
        <span className="hidden sm:inline text-gray-300 text-xs shrink-0">Unassigned</span>
      )}

      {canWrite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeMutation.mutate(task.id);
          }}
          disabled={removeMutation.isPending}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1 rounded"
          title="Remove from sprint"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// ── Add tasks modal ───────────────────────────────────────────────────────────
function AddTasksModal({ projectId, sprintId, sprintTaskIds, onClose }) {
  // Fetch all project backlog tasks (not done, not in a sprint)
  const { data: allTasks = [], isLoading } = useTasks(projectId, { limit: 500 });
  const addMutation = useAddTaskToSprint(projectId, sprintId);

  const [selected, setSelected] = useState(new Set());
  const [adding, setAdding]     = useState(false);

  const backlogTasks = useMemo(
    () =>
      allTasks.filter(
        (t) =>
          t.status !== 'done' &&
          !sprintTaskIds.has(String(t.id))
      ),
    [allTasks, sprintTaskIds]
  );

  function toggleTask(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!selected.size) return;
    setAdding(true);
    try {
      await Promise.all([...selected].map((id) => addMutation.mutateAsync(id)));
      onClose();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : backlogTasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No backlog tasks available to add.
        </p>
      ) : (
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 border border-gray-100 rounded-xl">
          {backlogTasks.map((task) => (
            <label
              key={task.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-indigo-50/30 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(task.id)}
                onChange={() => toggleTask(task.id)}
                className="rounded accent-indigo-600 shrink-0"
              />
              <span className="flex-1 text-sm text-gray-800 truncate">{task.title}</span>
              <PriorityBadge priority={task.priority} />
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-gray-400">
          {selected.size > 0 ? `${selected.size} task${selected.size !== 1 ? 's' : ''} selected` : 'Select tasks to add'}
        </span>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} loading={adding} disabled={!selected.size}>
            Add to Sprint
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── SprintDetailPage ──────────────────────────────────────────────────────────
export function SprintDetailPage() {
  const { projectId, sprintId } = useParams({ strict: false });
  const { data: project }         = useProject(projectId);
  const { data: sprint, isLoading: sprintLoading } = useSprint(projectId, sprintId);
  const { data: burndownData = [] }                 = useSprintBurndown(projectId, sprintId);
  const startMutation    = useStartSprint(projectId, sprintId);
  const completeMutation = useCompleteSprint(projectId, sprintId);
  const { user }         = useAuthStore();
  const { openTaskDrawer, setActiveProject } = useUiStore();

  const [showAddTasks, setShowAddTasks] = useState(false);

  const canWrite = hasMinRole(user?.role, 'member');

  // Sprint tasks come from sprint.tasks; group by status
  const sprintTasks = sprint?.tasks ?? [];
  const sprintTaskIds = useMemo(
    () => new Set(sprintTasks.map((t) => String(t.id))),
    [sprintTasks]
  );

  const STATUS_ORDER = ['todo', 'in_progress', 'review', 'done'];
  const tasksByStatus = useMemo(() => {
    const groups = {};
    STATUS_ORDER.forEach((s) => { groups[s] = []; });
    sprintTasks.forEach((t) => {
      const key = STATUS_ORDER.includes(t.status) ? t.status : 'todo';
      groups[key].push(t);
    });
    return groups;
  }, [sprintTasks]);

  const doneTasks  = sprintTasks.filter((t) => t.status === 'done').length;
  const totalTasks = sprintTasks.length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  function handleOpenTask(taskId) {
    setActiveProject(projectId);
    openTaskDrawer(taskId);
  }

  if (sprintLoading) {
    return (
      <div className="h-full flex flex-col">
        <ProjectNav projectId={projectId} project={project} />
        <div className="flex-1 p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="h-full flex flex-col">
        <ProjectNav projectId={projectId} project={project} />
        <div className="flex-1 flex items-center justify-center text-gray-400">
          Sprint not found.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-5xl mx-auto space-y-5">

          {/* Sprint header card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                  <h1 className="text-xl font-black text-gray-900">{sprint.name}</h1>
                  <SprintStatusBadge status={sprint.status} />
                </div>

                {sprint.goal && (
                  <p className="text-sm text-gray-500 flex items-start gap-1.5 mt-2">
                    <Target size={14} className="mt-0.5 shrink-0 text-indigo-400" />
                    {sprint.goal}
                  </p>
                )}

                {(sprint.start_date || sprint.end_date) && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <CalendarDays size={13} />
                      <span>
                        {sprint.start_date ? formatDate(sprint.start_date) : '—'}
                        {' → '}
                        {sprint.end_date ? formatDate(sprint.end_date) : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Progress */}
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {doneTasks}/{totalTasks} done ({progressPct}%)
                  </span>
                </div>
              </div>

              {/* Sprint actions */}
              {canWrite && (
                <div className="flex items-center gap-2 shrink-0">
                  {sprint.status === 'planning' && (
                    <Button
                      loading={startMutation.isPending}
                      onClick={() => startMutation.mutate()}
                    >
                      <Play size={14} /> Start Sprint
                    </Button>
                  )}
                  {sprint.status === 'active' && (
                    <Button
                      variant="success"
                      loading={completeMutation.isPending}
                      onClick={() => completeMutation.mutate()}
                    >
                      <CheckCheck size={14} /> Complete Sprint
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Burndown chart card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Burndown Chart</h2>
            <div className="min-h-[180px] sm:min-h-[240px]">
              <BurndownChart sprint={sprint} burndownData={burndownData} />
            </div>
          </div>

          {/* Task list card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Task list header */}
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={16} className="text-indigo-400" />
                <h2 className="text-sm font-bold text-gray-700">Tasks</h2>
                <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {totalTasks}
                </span>
              </div>
              {canWrite && (
                <Button size="sm" variant="secondary" onClick={() => setShowAddTasks(true)}>
                  <Plus size={13} /> Add Tasks
                </Button>
              )}
            </div>

            {sprintTasks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-gray-400 text-sm">No tasks in this sprint yet.</p>
                {canWrite && (
                  <button
                    onClick={() => setShowAddTasks(true)}
                    className="mt-2 text-indigo-500 text-sm underline hover:text-indigo-700"
                  >
                    Add tasks from backlog
                  </button>
                )}
              </div>
            ) : (
              <div>
                {STATUS_ORDER.map((status) => {
                  const group = tasksByStatus[status] ?? [];
                  if (group.length === 0) return null;
                  return (
                    <div key={status}>
                      {/* Status column header */}
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[status])}>
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="text-xs text-gray-400">{group.length}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {group.map((task) => (
                          <SprintTaskRow
                            key={task.id}
                            task={task}
                            projectId={projectId}
                            sprintId={sprintId}
                            canWrite={canWrite}
                            onOpen={handleOpenTask}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddTasks && (
        <Modal
          open
          onClose={() => setShowAddTasks(false)}
          title="Add tasks to sprint"
          className="max-w-xl"
        >
          <AddTasksModal
            projectId={projectId}
            sprintId={sprintId}
            sprintTaskIds={sprintTaskIds}
            onClose={() => setShowAddTasks(false)}
          />
        </Modal>
      )}
    </div>
  );
}
