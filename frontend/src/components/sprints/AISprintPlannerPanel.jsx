import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckSquare,
  Square,
  X,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/shared/PriorityBadge';

// ── Capacity progress bar ─────────────────────────────────────────────────────
function CapacityBar({ used, total }) {
  const pct = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
  const overCapacity = total > 0 && used > total;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-slate-400">
          {used}h / {total}h capacity
        </span>
        <span
          className={cn(
            'font-bold',
            overCapacity
              ? 'text-red-500'
              : pct > 85
              ? 'text-amber-500'
              : 'text-emerald-600 dark:text-emerald-400'
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            overCapacity
              ? 'bg-red-500'
              : pct > 85
              ? 'bg-amber-400'
              : 'bg-emerald-500'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Task row (checkbox + details) ─────────────────────────────────────────────
function TaskRow({ task, checked, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors',
        checked
          ? 'border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20'
          : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'
      )}
    >
      {checked ? (
        <CheckSquare size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
      ) : (
        <Square size={14} className="text-gray-300 dark:text-slate-500 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug truncate">
          {task.title}
        </p>
        {task.estimated_hours != null && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            {task.estimated_hours}h estimated
          </p>
        )}
      </div>
      {task.priority && (
        <PriorityBadge priority={task.priority} />
      )}
    </button>
  );
}

// ── AISprintPlannerPanel ───────────────────────────────────────────────────────
/**
 * Props:
 *   projectId  — required; used to call the API
 *   sprintId   — optional; when editing an existing sprint
 *   onClose()  — close the panel
 *   onApply(selectedTaskIds) — called when user clicks "Apply to Sprint"
 */
export function AISprintPlannerPanel({ projectId, sprintId, onClose, onApply }) {
  const [capacity, setCapacity]       = useState(40);
  const [goal, setGoal]               = useState('');
  const [sprintName, setSprintName]   = useState('');
  const [plan, setPlan]               = useState(null);
  const [checked, setChecked]         = useState({});
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/projects/${projectId}/ai-sprint-plan`, {
          capacity_hours: capacity,
          goal: goal.trim() || undefined,
          sprint_name: sprintName.trim() || undefined,
          sprint_id: sprintId || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setPlan(data);
      // Default: all tasks checked
      const tasks = data.tasks ?? [];
      setChecked(Object.fromEntries(tasks.map((t, i) => [t.id ?? i, true])));
      setAiUnavailable(false);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || '';
      if (
        msg.toLowerCase().includes('anthropic') ||
        msg.toLowerCase().includes('api_key') ||
        err.response?.status === 503
      ) {
        setAiUnavailable(true);
      }
    },
  });

  function toggleTask(key) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleApply() {
    if (!plan) return;
    const tasks = plan.tasks ?? [];
    const selectedIds = tasks
      .filter((t, i) => checked[t.id ?? i])
      .map((t) => t.id)
      .filter(Boolean);
    onApply(selectedIds);
  }

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const totalTasks    = plan?.tasks?.length ?? 0;

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col overflow-hidden',
          'border-l border-gray-100 dark:border-slate-700 animate-[slidein_0.2s_ease]',
          'w-full max-w-lg'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">AI Sprint Planner</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 text-xs font-semibold">
              <Sparkles size={9} />
              AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* AI unavailable error */}
          {aiUnavailable && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">
                Configure{' '}
                <code className="font-mono text-xs bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded">
                  ANTHROPIC_API_KEY
                </code>{' '}
                to enable AI sprint planning.
              </p>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Team Capacity (hours)
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 40)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Sprint Goal <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Launch checkout flow"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1">
                Sprint Name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder="e.g. Sprint 5"
                className={inputClass}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              loading={generateMutation.isPending}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  AI is analyzing your backlog and team velocity…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate Plan
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {plan && !generateMutation.isPending && (
            <div className="space-y-5 pt-2 border-t border-gray-100 dark:border-slate-700">

              {/* Suggested sprint name */}
              {plan.sprint_name && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Suggested Sprint Name
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {plan.sprint_name}
                  </p>
                </div>
              )}

              {/* Historical velocity */}
              {plan.historical_velocity != null && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  Historical velocity:{' '}
                  <span className="font-semibold text-gray-600 dark:text-slate-300">
                    {plan.historical_velocity}h/sprint
                  </span>
                </p>
              )}

              {/* Capacity utilisation */}
              {plan.estimated_hours != null && (
                <CapacityBar used={plan.estimated_hours} total={capacity} />
              )}

              {/* Warnings */}
              {plan.warnings?.length > 0 && (
                <div className="space-y-2">
                  {plan.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl"
                    >
                      <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Task list */}
              {totalTasks > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Recommended Tasks ({totalTasks})
                  </p>
                  <div className="space-y-2">
                    {plan.tasks.map((task, i) => {
                      const key = task.id ?? i;
                      return (
                        <TaskRow
                          key={key}
                          task={task}
                          checked={!!checked[key]}
                          onToggle={() => toggleTask(key)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Apply button */}
              <Button
                className="w-full"
                onClick={handleApply}
                disabled={selectedCount === 0}
              >
                Apply {selectedCount} task{selectedCount !== 1 ? 's' : ''} to Sprint
              </Button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slidein {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
