import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Sparkles, X, AlertTriangle, Lightbulb, RefreshCw } from 'lucide-react';

const STATUS_STYLE = {
  on_track: { label: 'On Track', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  at_risk:  { label: 'At Risk',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  blocked:  { label: 'Blocked',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function AISummaryButton({ projectId }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);

  const generate = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/ai-summary`).then(r => r.data),
    onSuccess: (data) => setResult(data),
  });

  function handleOpen() {
    setOpen(true);
    if (!result) generate.mutate();
  }

  const badge = result ? (STATUS_STYLE[result.status] || STATUS_STYLE.on_track) : null;

  return (
    <>
      <Button size="sm" variant="secondary" onClick={handleOpen}>
        <Sparkles size={13} className="text-indigo-500" />
        AI Summary
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles size={18} className="text-indigo-500 shrink-0" />
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">AI Project Summary</h3>
                  {badge && (
                    <span className={cn('text-xs px-2.5 py-1 rounded-full font-semibold', badge.cls)}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {generate.isPending && (
                <div className="space-y-3 animate-pulse py-4">
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-full" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-5/6" />
                  <div className="h-3 bg-gray-100 dark:bg-slate-700 rounded-full w-2/3" />
                  <p className="text-xs text-gray-400 text-center pt-2">Analyzing project…</p>
                </div>
              )}

              {generate.isError && (
                <div className="text-center py-6">
                  <p className="text-sm text-red-500 mb-3">Failed to generate summary.</p>
                  <Button size="sm" variant="secondary" onClick={() => generate.mutate()}>
                    <RefreshCw size={13} /> Try again
                  </Button>
                </div>
              )}

              {result && !generate.isPending && (
                <div className="space-y-4">
                  {/* Completion */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                      <span>Completion</span>
                      <span className="font-bold text-gray-700 dark:text-slate-200">{result.completion}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${result.completion}%` }}
                      />
                    </div>
                    {result.statusCounts && (
                      <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                        {Object.entries(result.statusCounts).map(([k, v]) => (
                          <span key={k}>{v} {k.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">
                    {result.summary}
                  </p>

                  {/* Risks */}
                  {result.risks?.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-100 dark:border-red-800">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
                        <AlertTriangle size={12} /> Risks
                      </p>
                      <ul className="space-y-1.5">
                        {result.risks.map((r, i) => (
                          <li key={i} className="text-sm text-red-700 dark:text-red-300 flex gap-1.5">
                            <span className="shrink-0">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommendations?.length > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2 uppercase tracking-wide">
                        <Lightbulb size={12} /> Recommendations
                      </p>
                      <ul className="space-y-1.5">
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-indigo-700 dark:text-indigo-300 flex gap-1.5">
                            <span className="shrink-0">•</span> {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-gray-400">
                      {result.generated_by === 'ai' ? '✨ Generated by Claude AI' : '📊 Rule-based analysis'}
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => { setResult(null); generate.mutate(); }}
                      loading={generate.isPending}
                    >
                      <RefreshCw size={12} /> Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
