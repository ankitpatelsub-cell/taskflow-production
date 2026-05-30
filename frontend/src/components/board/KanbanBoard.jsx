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

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];

export function KanbanBoard({ projectId, filters = {} }) {
  const { data, isLoading } = useTasks(projectId, {
    ...(filters.assignee  && { assignee:  filters.assignee }),
    ...(filters.priority  && { priority:  filters.priority }),
    ...(filters.tag       && { tag:       filters.tag }),
    ...(filters.q         && { q:         filters.q }),
    limit: 200,
  });
  const tasks = data?.tasks || [];
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 h-full overflow-x-auto">
        {COLUMNS.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            title={STATUS_LABELS[status]}
            tasks={tasks.filter((t) => t.status === status)}
            projectId={projectId}
            filtered={hasFilters}
          />
        ))}
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
