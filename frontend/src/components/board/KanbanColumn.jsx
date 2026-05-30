import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from '@/components/tasks/TaskCard';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useCreateTask } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

const COLUMN_STYLES = {
  todo:        { header: 'bg-slate-500',   dot: 'bg-slate-400',   bg: 'bg-slate-50'   },
  in_progress: { header: 'bg-indigo-500',  dot: 'bg-indigo-400',  bg: 'bg-indigo-50'  },
  review:      { header: 'bg-amber-500',   dot: 'bg-amber-400',   bg: 'bg-amber-50'   },
  done:        { header: 'bg-emerald-500', dot: 'bg-emerald-400', bg: 'bg-emerald-50' },
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

export function KanbanColumn({ status, title, color, tasks, projectId }) {
  const styles = COLUMN_STYLES[status] || COLUMN_STYLES.todo;
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const [showAdd, setShowAdd] = useState(false);
  const create = useCreateTask(projectId);

  function handleCreate(data) {
    create.mutate({ ...data, status }, { onSuccess: () => setShowAdd(false) });
  }

  return (
    <>
      <div className={cn(
        'w-72 shrink-0 rounded-2xl flex flex-col max-h-full transition-all',
        styles.bg,
        isOver && 'ring-2 ring-indigo-400 ring-offset-2'
      )}>
        {/* Column header */}
        <div className="px-3.5 pt-3.5 pb-2 flex items-center gap-2 shrink-0">
          <span className={cn('w-2.5 h-2.5 rounded-full', styles.dot)} />
          <span className="text-sm font-bold text-gray-700 flex-1">{title}</span>
          <span className="bg-white/80 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm">
            {tasks.length}
          </span>
          <button
            onClick={() => setShowAdd(true)}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/60 text-gray-500 hover:bg-white hover:text-indigo-600 transition-all shadow-sm"
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
          {tasks.length === 0 && (
            <div className="h-20 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center">
              <p className="text-xs text-gray-400">Drop tasks here</p>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} title={`Add task to ${title}`}>
          <TaskForm
            projectId={projectId}
            defaultValues={{ status, priority: 'medium' }}
            onSubmit={handleCreate}
            onCancel={() => setShowAdd(false)}
            loading={create.isPending}
          />
        </Modal>
      )}
    </>
  );
}
