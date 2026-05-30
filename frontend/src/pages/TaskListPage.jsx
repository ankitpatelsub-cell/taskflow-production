import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTasks } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProjects';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useCreateTask } from '@/hooks/useTasks';
import { ProjectNav } from './ProjectNav';

export function TaskListPage() {
  const { projectId } = useParams({ strict: false });
  const [filters, setFilters] = useState({});
  const { data: tasks = [], isLoading } = useTasks(projectId, filters);
  const { data: project } = useProject(projectId);
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const [showAdd, setShowAdd] = useState(false);
  const create = useCreateTask(projectId);

  function openTask(id) {
    setActiveProject(projectId);
    openTaskDrawer(id);
  }

  function handleCreate(data) {
    create.mutate(data, { onSuccess: () => setShowAdd(false) });
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="p-6 flex-1 overflow-auto page-fade">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{tasks.length}</span> tasks
          </p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={15} />Add Task
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-full">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">Loading…</td>
                </tr>
              )}
              {!isLoading && tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">No tasks yet</td>
                </tr>
              )}
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => openTask(task.id)}
                  className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{task.title}</span>
                      {task.tags?.length > 0 && (
                        <span className="flex gap-1">
                          {task.tags.map((t) => (
                            <span
                              key={t.id}
                              className="text-xs px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: t.color + '22', color: t.color }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[task.status])}>
                      {STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee_name ? (
                      <div className="flex items-center gap-1.5">
                        <Avatar name={task.assignee_name} size="sm" />
                        <span className="text-gray-700">{task.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {task.deadline ? (
                      <span className={cn('flex items-center gap-1', isOverdue(task.deadline) ? 'text-red-500 font-medium' : 'text-gray-400')}>
                        <Calendar size={12} />{formatDate(task.deadline)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Modal open onClose={() => setShowAdd(false)} title="New Task">
          <TaskForm
            projectId={projectId}
            defaultValues={{ priority: 'medium', status: 'todo' }}
            onSubmit={handleCreate}
            onCancel={() => setShowAdd(false)}
            loading={create.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
