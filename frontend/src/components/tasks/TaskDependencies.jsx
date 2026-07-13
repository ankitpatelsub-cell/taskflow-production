import { useState } from 'react';
import { useTaskDependencies, useAddDependency, useRemoveDependency } from '@/hooks/useTaskDependencies';
import { useTasks } from '@/hooks/useTasks';
import { cn, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { X, Plus, ArrowRight, ArrowLeft } from 'lucide-react';

function DepRow({ dep, onRemove }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0', STATUS_COLORS[dep.status])}>
        {STATUS_LABELS[dep.status]}
      </span>
      <span className="text-sm text-gray-800 flex-1 truncate">{dep.title}</span>
      {dep.assignee_name && (
        <span className="text-xs text-gray-400 shrink-0">{dep.assignee_name}</span>
      )}
      <button
        onClick={() => onRemove(dep.dep_id)}
        className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
        title="Remove dependency"
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function TaskDependencies({ taskId, projectId }) {
  const { data, isLoading } = useTaskDependencies(taskId);
  const { data: allTasks = [] } = useTasks(projectId);
  const addDep = useAddDependency(taskId);
  const removeDep = useRemoveDependency(taskId);
  const [adding, setAdding] = useState(null); // 'blocked_by' | 'blocks'
  const [selected, setSelected] = useState('');

  const existingIds = new Set([
    taskId,
    ...(data?.blocked_by || []).map((d) => d.id),
    ...(data?.blocks || []).map((d) => d.id),
  ]);

  const availableTasks = allTasks.filter((t) => !existingIds.has(t.id) && !t.parent_task_id);

  async function handleAdd() {
    if (!selected) return;
    if (adding === 'blocked_by') {
      await addDep.mutateAsync(selected);
    } else {
      // "this blocks selected task" — add dep from selected -> this task
      await addDep.mutateAsync(selected);
    }
    setAdding(null);
    setSelected('');
  }

  if (isLoading) return <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      {/* Blocked by */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <ArrowLeft size={12} className="text-red-400" />
            Blocked by
          </div>
          <button
            onClick={() => { setAdding('blocked_by'); setSelected(''); }}
            className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 transition-colors"
          >
            <Plus size={11} /> Add
          </button>
        </div>
        {adding === 'blocked_by' && (
          <div className="flex gap-2 mb-2">
            <select
              autoFocus
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="flex-1 text-sm border border-indigo-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select a task…</option>
              {availableTasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!selected || addDep.isPending}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
            <button onClick={() => setAdding(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        )}
        {data?.blocked_by?.length === 0 && adding !== 'blocked_by' && (
          <p className="text-xs text-gray-400 italic">No blockers</p>
        )}
        <div className="space-y-1.5">
          {data?.blocked_by?.map((dep) => (
            <DepRow key={dep.dep_id} dep={dep} onRemove={(depId) => removeDep.mutate(depId)} />
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100" />

      {/* Blocks */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <ArrowRight size={12} className="text-amber-400" />
            Blocks
          </div>
        </div>
        {data?.blocks?.length === 0 && (
          <p className="text-xs text-gray-400 italic">Doesn't block any tasks</p>
        )}
        <div className="space-y-1.5">
          {data?.blocks?.map((dep) => (
            <DepRow key={dep.dep_id} dep={dep} onRemove={(depId) => removeDep.mutate(depId)} />
          ))}
        </div>
      </div>
    </div>
  );
}
