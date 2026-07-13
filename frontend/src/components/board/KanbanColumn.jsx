import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Plus, X } from 'lucide-react';
import { useCreateTask } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const COLUMN_STYLES = {
  todo:        { dot: 'bg-slate-400',   bg: 'bg-slate-50 dark:bg-slate-800/50'      },
  in_progress: { dot: 'bg-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-900/20'    },
  review:      { dot: 'bg-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/15'      },
  done:        { dot: 'bg-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/15'  },
};

function SortableTaskCard({ task, projectId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn('transition-opacity', isDragging && 'opacity-40 scale-95')}>
      <TaskCard task={task} projectId={projectId} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export function KanbanColumn({ status, title, tasks, projectId }) {
  const styles = COLUMN_STYLES[status] || COLUMN_STYLES.todo;
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const inputRef = useRef(null);
  const create = useCreateTask(projectId);

  function openQuickAdd() {
    setQuickAdd(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelQuickAdd() {
    setQuickAdd(false);
    setQuickTitle('');
  }

  function submitQuickAdd() {
    const title = quickTitle.trim();
    if (!title) { cancelQuickAdd(); return; }
    create.mutate(
      { title, status, priority: 'medium' },
      { onSuccess: () => { setQuickTitle(''); inputRef.current?.focus(); } }
    );
  }

  return (
    <div className={cn(
      'w-72 shrink-0 rounded-2xl flex flex-col max-h-full transition-all',
      styles.bg,
      isOver && 'ring-2 ring-indigo-400 ring-offset-2'
    )}>
      {/* Column header */}
      <div className="px-3.5 pt-3.5 pb-2 flex items-center gap-2 shrink-0">
        <span className={cn('w-2.5 h-2.5 rounded-full', styles.dot)} />
        <span className="text-sm font-bold text-gray-700 dark:text-slate-200 flex-1">{title}</span>
        <span className="bg-white/80 dark:bg-slate-700/80 text-gray-500 dark:text-slate-300 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
          {tasks.length}
        </span>
        <button
          onClick={openQuickAdd}
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/60 dark:bg-slate-700/60 text-gray-500 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all shadow-sm"
          title="Add task"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Task list */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-[80px]">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </SortableContext>

        {tasks.length === 0 && !quickAdd && (
          <div
            className="h-24 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-center px-3 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors"
            onClick={openQuickAdd}
          >
            <p className="text-xs font-medium text-gray-400 dark:text-slate-500">No tasks yet</p>
            <p className="text-[11px] text-gray-300 dark:text-slate-600">Click to add one or drop a card here</p>
          </div>
        )}

        {/* Inline quick-add input */}
        {quickAdd && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-700 shadow-sm p-2.5 space-y-2">
            <textarea
              ref={inputRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuickAdd(); }
                if (e.key === 'Escape') cancelQuickAdd();
              }}
              placeholder="Task title… (Enter to save)"
              rows={2}
              className="w-full text-sm text-gray-800 dark:text-white bg-transparent resize-none focus:outline-none placeholder:text-gray-300 dark:placeholder:text-slate-500"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={submitQuickAdd}
                disabled={create.isPending || !quickTitle.trim()}
                className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={11} /> Add
              </button>
              <button
                onClick={cancelQuickAdd}
                className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
