import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, ChevronDown, ChevronRight, CheckSquare, Square, CheckCircle2, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';

// ─── Collapsible description ──────────────────────────────────────────────────
function CollapsibleDescription({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 leading-relaxed pl-4">
          {text}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MeetingNotesModal({ projectId, onClose }) {
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState(null);       // extracted tasks array
  const [checked, setChecked] = useState({});     // idx -> bool
  const [created, setCreated] = useState(null);   // number of successfully created tasks
  const [creating, setCreating] = useState(false);

  const extract = useMutation({
    mutationFn: () =>
      api
        .post(`/projects/${projectId}/ai/meeting-notes`, { notes })
        .then((r) => r.data),
    onSuccess: (data) => {
      const items = Array.isArray(data) ? data : data.tasks ?? [];
      setTasks(items);
      setChecked(Object.fromEntries(items.map((_, i) => [i, true])));
    },
    onError: () => {
      toast.error('Failed to extract tasks. Please try again.');
    },
  });

  function toggleCheck(idx) {
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  function toggleAll() {
    const anyUnchecked = tasks.some((_, i) => !checked[i]);
    setChecked(Object.fromEntries(tasks.map((_, i) => [i, anyUnchecked])));
  }

  async function createSelected() {
    const selected = tasks.filter((_, i) => checked[i]);
    if (!selected.length) {
      toast.error('Select at least one task to create.');
      return;
    }
    setCreating(true);
    let successCount = 0;
    await Promise.allSettled(
      selected.map((t) =>
        api
          .post(`/projects/${projectId}/tasks`, {
            title: t.title,
            description: t.description ?? '',
            priority: t.priority ?? 'medium',
          })
          .then(() => { successCount++; })
      )
    );
    await queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    setCreating(false);
    setCreated(successCount);
  }

  const selectedCount = tasks ? Object.values(checked).filter(Boolean).length : 0;
  const allChecked = tasks ? tasks.every((_, i) => checked[i]) : false;

  return (
    <Modal open onClose={onClose} title="Meeting Notes → Tasks" className="max-w-2xl">
      <div className="space-y-5">

        {/* Success state */}
        {created !== null ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl">
              <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {created} task{created !== 1 ? 's' : ''} created successfully
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  They have been added to the project board.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setNotes('');
                  setTasks(null);
                  setChecked({});
                  setCreated(null);
                }}
              >
                Extract More
              </Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Notes input */}
            {!tasks && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1.5">
                    Meeting Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={10}
                    placeholder="Paste meeting notes here…&#10;&#10;The AI will extract action items, tasks, and decisions into structured tasks."
                    className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3.5 py-3 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Tip: Include action items, owners, and deadlines for best results.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => extract.mutate()}
                    disabled={!notes.trim() || extract.isPending}
                    loading={extract.isPending}
                  >
                    {extract.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Extracting…
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        Extract Tasks
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Extracted tasks list */}
            {tasks && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''} extracted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleAll}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {allChecked ? 'Deselect all' : 'Select all'}
                    </button>
                    <button
                      onClick={() => { setTasks(null); setChecked({}); }}
                      className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      ← Back
                    </button>
                  </div>
                </div>

                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
                    No tasks could be extracted. Try adding more detail to your notes.
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {tasks.map((t, i) => (
                      <li key={i}>
                        <button
                          onClick={() => toggleCheck(i)}
                          className={cn(
                            'w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border text-left transition-colors',
                            checked[i]
                              ? 'border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700'
                              : 'border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                          )}
                        >
                          <span className="shrink-0 mt-0.5">
                            {checked[i] ? (
                              <CheckSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <Square size={15} className="text-gray-300 dark:text-slate-500" />
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-800 dark:text-white leading-snug">
                                {t.title}
                              </p>
                              {t.priority && (
                                <PriorityBadge priority={t.priority} />
                              )}
                            </div>
                            {t.assignee_name && (
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                Assignee: <span className="font-medium">{t.assignee_name}</span>
                              </p>
                            )}
                            <CollapsibleDescription text={t.description} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {selectedCount} of {tasks.length} selected
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={onClose} size="sm">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={createSelected}
                      disabled={selectedCount === 0 || creating}
                      loading={creating}
                    >
                      {creating
                        ? 'Creating…'
                        : `Create ${selectedCount} Task${selectedCount !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
