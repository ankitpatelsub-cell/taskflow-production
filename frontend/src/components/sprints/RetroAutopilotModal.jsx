import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, X, ChevronRight, ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export function RetroAutopilotModal({ projectId, sprint, onClose }) {
  const [result, setResult] = useState(null);

  const retroMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/projects/${projectId}/sprints/${sprint.id}/retrospective`);
      return data;
    },
    onSuccess: setResult,
  });

  const healthColor = result
    ? result.retrospective.health_score >= 75
      ? 'text-emerald-600'
      : result.retrospective.health_score >= 50
        ? 'text-amber-600'
        : 'text-red-600'
    : '';

  return (
    <Modal onClose={onClose} title="" size="lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Retrospective Autopilot</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {!result && !retroMutation.isPending && (
          <div className="text-center py-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
              <ClipboardList className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <p className="text-base font-medium text-gray-900 dark:text-white">Generate retro for "{sprint.name}"</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                AI will analyze your sprint data — completed tasks, slipped items, team workload, and scope changes — and generate a pre-filled retrospective.
              </p>
            </div>
            {retroMutation.isError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {retroMutation.error?.response?.data?.error || 'Failed to generate. Please try again.'}
              </div>
            )}
            <Button
              onClick={() => retroMutation.mutate()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Retrospective
            </Button>
          </div>
        )}

        {retroMutation.isPending && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Analyzing sprint data…</p>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            {/* Metrics row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.metrics.completion_rate}%</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Completed</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                <p className={cn('text-2xl font-bold', healthColor)}>{result.retrospective.health_score}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Health Score</p>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{result.metrics.scope_adds}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Scope Adds</p>
              </div>
            </div>

            {/* Key metric */}
            {result.retrospective.key_metric && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  🎯 {result.retrospective.key_metric}
                </p>
              </div>
            )}

            {/* Summary */}
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Summary</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{result.retrospective.summary}</p>
            </div>

            {/* Went well */}
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> What Went Well
              </p>
              <ul className="space-y-1.5">
                {result.retrospective.went_well?.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvement areas */}
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Improvement Areas
              </p>
              <ul className="space-y-1.5">
                {result.retrospective.improvement_areas?.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action items */}
            {result.retrospective.action_items?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                  <ChevronRight className="w-4 h-4" /> Action Items
                </p>
                <div className="space-y-2">
                  {result.retrospective.action_items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 dark:bg-slate-800 rounded-lg">
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded mt-0.5 whitespace-nowrap">{item.by_when}</span>
                      <div>
                        <p className="text-sm text-gray-800 dark:text-gray-200">{item.action}</p>
                        {item.owner && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Owner: {item.owner}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => { setResult(null); retroMutation.reset(); }} className="flex-1">
                Regenerate
              </Button>
              <Button onClick={onClose} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
