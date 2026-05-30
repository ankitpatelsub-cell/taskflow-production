import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTasks, useDeleteTask } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProjects';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Plus, Trash2, Download, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useCreateTask } from '@/hooks/useTasks';
import { ProjectNav } from './ProjectNav';
import { TableSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

export function TaskListPage() {
  const { projectId } = useParams({ strict: false });
  const [filters, setFilters] = useState({});
  const { data, isLoading } = useTasks(projectId, { ...filters, limit: 200 });
  const tasks = data?.tasks || [];
  const { data: project } = useProject(projectId);
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const create = useCreateTask(projectId);

  // Members for filter
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data.members),
    enabled: !!projectId,
  });

  function openTask(id) { setActiveProject(projectId); openTaskDrawer(id); }
  function handleCreate(data) { create.mutate(data, { onSuccess: () => setShowAdd(false) }); }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(selected.size === tasks.length ? new Set() : new Set(tasks.map((t) => t.id)));
  }

  async function applyBulkStatus() {
    if (!bulkStatus || !selected.size) return;
    await api.patch(`/projects/${projectId}/tasks/bulk/update`, {
      taskIds: [...selected],
      updates: { status: bulkStatus },
    });
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    setSelected(new Set());
    setBulkStatus('');
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} task(s)?`)) return;
    await Promise.all([...selected].map((id) => api.delete(`/projects/${projectId}/tasks/${id}`)));
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    setSelected(new Set());
  }

  function handleExport() {
    window.open(`/api/projects/${projectId}/tasks/export.csv`, '_blank');
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="p-6 flex-1 overflow-auto page-fade">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              <span className="font-bold text-gray-800 dark:text-white">{tasks.length}</span> tasks
            </p>
            {/* Assignee filter */}
            <select
              value={filters.assignee || ''}
              onChange={(e) => setFilters((f) => ({ ...f, assignee: e.target.value || undefined }))}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All assignees</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select
              value={filters.priority || ''}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value || undefined }))}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All priorities</option>
              {['low','medium','high','critical'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleExport}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add Task
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="mb-3 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-xl flex items-center gap-3 flex-wrap">
            <CheckSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2 ml-2">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
              >
                <option value="">Change status…</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
              {bulkStatus && (
                <Button size="sm" onClick={applyBulkStatus}>Apply</Button>
              )}
              <Button size="sm" variant="danger" onClick={bulkDelete}>
                <Trash2 size={13} /> Delete
              </Button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 dark:text-slate-400 hover:underline ml-1">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden shadow-sm">
          {isLoading ? (
            <TableSkeleton />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-700/50">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === tasks.length && tasks.length > 0}
                      onChange={toggleAll}
                      className="rounded accent-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-full">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Assignee</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="text-4xl mb-3">📋</div>
                      <p className="font-semibold text-gray-500 dark:text-slate-400">No tasks yet</p>
                      <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Click "Add Task" to create your first task</p>
                    </td>
                  </tr>
                )}
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className={cn(
                      'hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors',
                      selected.has(task.id) && 'bg-indigo-50/50 dark:bg-indigo-900/20'
                    )}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(task.id)}
                        onChange={() => toggleSelect(task.id)}
                        className="rounded accent-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3" onClick={() => openTask(task.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-medium', task.status === 'done' ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white')}>
                          {task.title}
                        </span>
                        {task.tags?.length > 0 && task.tags.map((t) => (
                          <span key={t.id} className="text-xs px-1.5 py-0.5 rounded-md" style={{ backgroundColor: t.color + '22', color: t.color }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={() => openTask(task.id)}>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[task.status])}>
                        {STATUS_LABELS[task.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={() => openTask(task.id)}>
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-4 py-3" onClick={() => openTask(task.id)}>
                      {task.assignee_name ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar name={task.assignee_name} size="sm" />
                          <span className="text-gray-700 dark:text-slate-300 text-xs">{task.assignee_name}</span>
                        </div>
                      ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3" onClick={() => openTask(task.id)}>
                      {task.deadline ? (
                        <span className={cn('flex items-center gap-1 text-xs', isOverdue(task.deadline) && task.status !== 'done' ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-slate-500')}>
                          <Calendar size={12} />{formatDate(task.deadline)}
                        </span>
                      ) : <span className="text-gray-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
