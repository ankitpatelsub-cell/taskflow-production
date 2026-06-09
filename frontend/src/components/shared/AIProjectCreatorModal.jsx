import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { toast } from '@/components/ui/Toast';

// ── Duration options ───────────────────────────────────────────────────────────
const DURATION_OPTIONS = [1, 2, 4, 8, 12];

// ── Generated task row ────────────────────────────────────────────────────────
function GeneratedTaskRow({ task }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug">
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">
            {task.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        {task.priority && <PriorityBadge priority={task.priority} />}
        {task.estimated_hours != null && (
          <span className="flex items-center gap-0.5 text-xs text-gray-400 dark:text-slate-500">
            <Clock size={11} />
            {task.estimated_hours}h
          </span>
        )}
      </div>
    </div>
  );
}

// ── AIProjectCreatorModal ─────────────────────────────────────────────────────
/**
 * Props:
 *   projectId  — the already-created project to generate tasks for
 *   onClose()  — close the modal
 *   onDone()   — optional; called after tasks are applied
 */
export function AIProjectCreatorModal({ projectId, onClose, onDone }) {
  const [description, setDescription] = useState('');
  const [duration, setDuration]        = useState(4);
  const [plan, setPlan]                = useState(null);
  const [applying, setApplying]        = useState(false);
  const [applied, setApplied]          = useState(false);

  // ── Generate plan ────────────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: () =>
      api
        .post(`/projects/${projectId}/ai-create`, {
          description: description.trim(),
          duration_weeks: duration,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setPlan(data);
      setApplied(false);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to generate project plan. Please try again.');
    },
  });

  // ── Apply tasks ───────────────────────────────────────────────────────────────
  async function handleApply() {
    if (!plan?.tasks?.length) return;
    setApplying(true);
    try {
      await Promise.all(
        plan.tasks.map((task) =>
          api.post(`/projects/${projectId}/tasks`, {
            title:           task.title,
            description:     task.description ?? '',
            priority:        task.priority ?? 'medium',
            estimated_hours: task.estimated_hours ?? null,
          })
        )
      );
      await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`${plan.tasks.length} task${plan.tasks.length !== 1 ? 's' : ''} created!`);
      setApplied(true);
      onDone?.();
    } catch {
      toast.error('Some tasks could not be created. Please try again.');
    } finally {
      setApplying(false);
    }
  }

  const totalHours = plan?.tasks?.reduce(
    (sum, t) => sum + (t.estimated_hours ?? 0),
    0
  );
  const isLoading = generateMutation.isPending;

  const textareaClass =
    'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500 resize-none';

  return (
    <Modal open onClose={onClose} title="AI Project Creator" className="max-w-xl">
      <div className="space-y-5">
        {/* AI badge */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-xs font-semibold">
            <Sparkles size={11} />
            Powered by AI
          </span>
        </div>

        {/* Description textarea */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5">
            Describe your project in plain English
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder={
              'e.g. "Build a mobile app for food delivery with user authentication, menu browsing, cart, and checkout."\n\n' +
              'or "Redesign our company website with a new brand identity, landing page, and blog section."'
            }
            className={textareaClass}
            disabled={isLoading}
          />
        </div>

        {/* Duration selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">
            Duration
          </label>
          <div className="flex gap-2 flex-wrap">
            {DURATION_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setDuration(w)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors',
                  duration === w
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
                disabled={isLoading}
              >
                {w}w
              </button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button
          className="w-full"
          onClick={() => generateMutation.mutate()}
          loading={isLoading}
          disabled={!description.trim() || isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              AI is creating your project plan…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Project Plan
            </>
          )}
        </Button>

        {/* Error state */}
        {generateMutation.isError && !isLoading && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {generateMutation.error?.response?.data?.error ||
                'Failed to generate plan. Please try again.'}
            </p>
          </div>
        )}

        {/* Results */}
        {plan && !isLoading && (
          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-700">
            {/* Summary header */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                Generated Tasks ({plan.tasks?.length ?? 0})
              </p>
              {totalHours > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                  <Clock size={11} />
                  ~{totalHours}h total
                </span>
              )}
            </div>

            {/* Task list */}
            {plan.tasks?.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {plan.tasks.map((task, i) => (
                  <GeneratedTaskRow key={task.id ?? i} task={task} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">
                No tasks were generated. Try a more detailed description.
              </p>
            )}

            {/* Actions */}
            {!applied ? (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleApply}
                  loading={applying}
                  disabled={applying || !plan.tasks?.length}
                >
                  {applying ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Creating tasks…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      Apply Tasks
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => generateMutation.mutate()}
                  disabled={isLoading || applying}
                  title="Regenerate"
                >
                  <RefreshCw size={14} />
                  Regenerate
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {plan.tasks?.length} task{plan.tasks?.length !== 1 ? 's' : ''} added to your project!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
