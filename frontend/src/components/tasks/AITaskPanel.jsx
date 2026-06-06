import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Clock, CheckSquare, Square, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';

// ─── Break Down panel ─────────────────────────────────────────────────────────
function BreakdownPanel({ projectId, taskId, task, onDone }) {
  const [subtasks, setSubtasks] = useState(null);
  const [checked, setChecked] = useState({});
  const [creating, setCreating] = useState(false);

  const breakdown = useMutation({
    mutationFn: () =>
      api
        .post(`/projects/${projectId}/ai/breakdown`, {
          title: task.title,
          description: task.description,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      const items = Array.isArray(data) ? data : data.subtasks ?? [];
      setSubtasks(items);
      // Default all checked
      setChecked(Object.fromEntries(items.map((_, i) => [i, true])));
    },
    onError: () => {
      toast.error('Failed to break down task. Please try again.');
    },
  });

  function toggleCheck(idx) {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  async function createSelected() {
    const selected = subtasks.filter((_, i) => checked[i]);
    if (!selected.length) {
      toast.error('Select at least one subtask to create.');
      return;
    }
    setCreating(true);
    try {
      await Promise.all(
        selected.map((st) =>
          api.post(`/projects/${projectId}/tasks`, {
            title: st.title,
            description: st.description ?? '',
            parent_task_id: taskId,
          })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success(`${selected.length} subtask${selected.length !== 1 ? 's' : ''} created.`);
      onDone();
    } catch {
      toast.error('Some subtasks could not be created.');
    } finally {
      setCreating(false);
    }
  }

  const selectedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-3">
      {!subtasks && !breakdown.isPending && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => breakdown.mutate()}
        >
          <Sparkles size={13} className="text-indigo-500" />
          Break Down Task
        </Button>
      )}

      {breakdown.isPending && (
        <div className="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-slate-400 justify-center">
          <Loader2 size={14} className="animate-spin text-indigo-500" />
          Analyzing task…
        </div>
      )}

      {subtasks && !breakdown.isPending && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            Suggested Subtasks
          </p>
          <ul className="space-y-1.5">
            {subtasks.map((st, i) => (
              <li key={i}>
                <button
                  onClick={() => toggleCheck(i)}
                  className={cn(
                    'w-full flex items-start gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors',
                    checked[i]
                      ? 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'
                      : 'border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  {checked[i] ? (
                    <CheckSquare size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                  ) : (
                    <Square size={14} className="text-gray-300 dark:text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug">
                      {st.title}
                    </p>
                    {st.description && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {st.description}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={createSelected}
              disabled={selectedCount === 0 || creating}
              loading={creating}
              className="flex-1"
            >
              {creating
                ? 'Creating…'
                : `Create ${selectedCount} subtask${selectedCount !== 1 ? 's' : ''}`}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setSubtasks(null); setChecked({}); }}
            >
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Estimate panel ───────────────────────────────────────────────────────────
function EstimatePanel({ projectId, taskId, task }) {
  const [estimate, setEstimate] = useState(null);
  const [applying, setApplying] = useState(false);

  const estimateMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/projects/${projectId}/ai/estimate`, {
          title: task.title,
          description: task.description,
          priority: task.priority,
        })
        .then((r) => r.data),
    onSuccess: (data) => setEstimate(data),
    onError: () => {
      toast.error('Failed to generate estimate. Please try again.');
    },
  });

  async function applyEstimate() {
    if (!estimate) return;
    setApplying(true);
    try {
      await api.patch(`/projects/${projectId}/tasks/${taskId}`, {
        estimated_hours: estimate.estimated_hours,
        deadline: estimate.suggested_deadline ?? undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      await queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Estimate applied to task.');
      setEstimate(null);
    } catch {
      toast.error('Failed to apply estimate.');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-3">
      {!estimate && !estimateMutation.isPending && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => estimateMutation.mutate()}
        >
          <Clock size={13} className="text-indigo-500" />
          Estimate Task
        </Button>
      )}

      {estimateMutation.isPending && (
        <div className="flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-slate-400 justify-center">
          <Loader2 size={14} className="animate-spin text-indigo-500" />
          Estimating…
        </div>
      )}

      {estimate && !estimateMutation.isPending && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            AI Estimate
          </p>
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Estimated hours</span>
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {estimate.estimated_hours}h
              </span>
            </div>
            {estimate.suggested_deadline && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-slate-400">Suggested deadline</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  {new Date(estimate.suggested_deadline).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
            {estimate.reasoning && (
              <p className="text-xs text-gray-500 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-800 leading-relaxed">
                {estimate.reasoning}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={applyEstimate}
              loading={applying}
              className="flex-1"
            >
              Apply to Task
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEstimate(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function AITaskPanel({ projectId, taskId, task }) {
  const [activePanel, setActivePanel] = useState(null); // 'breakdown' | 'estimate' | null

  return (
    <div className="rounded-xl border border-indigo-100 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 dark:from-indigo-900/20 dark:to-purple-900/10 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">AI Actions</span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 text-xs font-semibold">
          <Sparkles size={9} />
          AI
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setActivePanel(activePanel === 'breakdown' ? null : 'breakdown')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
            activePanel === 'breakdown'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300'
          )}
        >
          <Sparkles size={12} />
          Break Down
        </button>
        <button
          onClick={() => setActivePanel(activePanel === 'estimate' ? null : 'estimate')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
            activePanel === 'estimate'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300'
          )}
        >
          <Clock size={12} />
          Estimate
        </button>
      </div>

      {/* Active panel content */}
      {activePanel === 'breakdown' && (
        <div className="pt-1 border-t border-indigo-100 dark:border-indigo-800">
          <BreakdownPanel
            projectId={projectId}
            taskId={taskId}
            task={task}
            onDone={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === 'estimate' && (
        <div className="pt-1 border-t border-indigo-100 dark:border-indigo-800">
          <EstimatePanel projectId={projectId} taskId={taskId} task={task} />
        </div>
      )}
    </div>
  );
}
