import { useState } from 'react';
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from '@/components/tasks/TaskCard';
import { useTasks, useMoveTask } from '@/hooks/useTasks';
import { STATUS_LABELS } from '@/lib/utils';
import { BoardSkeleton } from '@/components/ui/Skeleton';
import { useTranslation } from 'react-i18next';

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];

export function KanbanBoard({ projectId, filters = {} }) {
  const { t } = useTranslation();
  const { data, isLoading } = useTasks(projectId, {
    ...(filters.assignee  && { assignee:  filters.assignee }),
    ...(filters.priority  && { priority:  filters.priority }),
    ...(filters.tag       && { tag:       filters.tag }),
    ...(filters.q         && { q:         filters.q }),
    ...(filters.to        && { to:        filters.to }),
    limit: 200,
  });
  const tasks = data || [];
  const move = useMoveTask(projectId);
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart({ active }) {
    setActiveTask(tasks.find((t) => t.id === active.id) || null);
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over || active.id === over.id) return;
    const newStatus = over.data?.current?.status || over.id;
    const current = tasks.find((t) => t.id === active.id);
    if (newStatus && COLUMNS.includes(newStatus) && current?.status !== newStatus) {
      move.mutate({ taskId: active.id, status: newStatus });
    }
  }

  if (isLoading) return <BoardSkeleton />;

  const hasFilters = Object.values(filters).some(Boolean);

  if (!hasFilters && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-sm px-6">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{t('task.noTasksYet')}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">
            {t('task.emptyBoardHint')}
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            {t('task.dragHint')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {COLUMNS.map((status) => {
          const colTasks = tasks.filter((t) => t.status === status);
          if (hasFilters && colTasks.length === 0) return null;
          return (
            <KanbanColumn
              key={status}
              status={status}
              title={STATUS_LABELS[status]}
              tasks={colTasks}
              projectId={projectId}
              filtered={hasFilters}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeTask && (
          <div className="rotate-2 scale-105 shadow-2xl opacity-90">
            <TaskCard task={activeTask} projectId={projectId} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
