import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTasks } from '@/hooks/useTasks';
import { useProject } from '@/hooks/useProjects';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue, isDueSoon, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Plus, Trash2, Download, CheckSquare, ArrowUp, ArrowDown, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { Modal } from '@/components/ui/Modal';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useCreateTask } from '@/hooks/useTasks';
import { ProjectNav } from './ProjectNav';
import { TableSkeleton } from '@/components/ui/Skeleton';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { toast } from '@/components/ui/Toast';

export function TaskListPage() {
  const { projectId } = useParams({ strict: false });
  const [filters, setFilters] = useState({});
  const { data: tasks = [], isLoading } = useTasks(projectId, { ...filters, limit: 200 });
  const { data: project } = useProject(projectId);
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const { user } = useAuthStore();
  const [showAdd, setShowAdd]     = useState(false);
  const [selected, setSelected]   = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [sort, setSort] = useState({ col: null, dir: 'asc' });
  const [search, setSearch] = useState('');

  const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
  const STATUS_ORDER   = { todo: 0, in_progress: 1, review: 2, done: 3 };

  const sortedTasks = useMemo(() => {
    const filtered = search
      ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
      : tasks;
    if (!sort.col) return filtered;
    return [...filtered].sort((a, b) => {
      let va, vb;
      if (sort.col === 'title')    { va = a.title.toLowerCase();  vb = b.title.toLowerCase(); }
      if (sort.col === 'status')   { va = STATUS_ORDER[a.status] ?? 9;   vb = STATUS_ORDER[b.status] ?? 9; }
      if (sort.col === 'priority') { va = PRIORITY_ORDER[a.priority] ?? 9; vb = PRIORITY_ORDER[b.priority] ?? 9; }
      if (sort.col === 'assignee') { va = (a.assignee_name || '').toLowerCase(); vb = (b.assignee_name || '').toLowerCase(); }
      if (sort.col === 'deadline') {
        va = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        vb = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      }
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tasks, sort, search]);

  function toggleSort(col) {
    setSort((s) => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  function SortIcon({ col }) {
    if (sort.col !== col) return <ChevronsUpDown size={12} className="text-gray-300 ml-0.5" />;
    return sort.dir === 'asc' ? <ArrowUp size={12} className="text-indigo-500 ml-0.5" /> : <ArrowDown size={12} className="text-indigo-500 ml-0.5" />;
  }
  const create = useCreateTask(projectId);

  // Members for filter
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data.members ?? []),
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
    try {
      await api.patch(`/projects/${projectId}/tasks/bulk/update`, {
        taskIds: [...selected],
        updates: { status: bulkStatus },
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`Updated ${selected.size} task(s)`);
      setSelected(new Set());
      setBulkStatus('');
    } catch {
      toast.error('Bulk update failed');
    }
  }

  async function applyBulkAssignee() {
    if (!selected.size) return;
    try {
      await api.patch(`/projects/${projectId}/tasks/bulk/update`, {
        taskIds: [...selected],
        updates: { assignee_id: bulkAssignee === '__unassign__' ? null : bulkAssignee || null },
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`Reassigned ${selected.size} task(s)`);
      setSelected(new Set());
      setBulkAssignee('');
    } catch {
      toast.error('Bulk reassign failed');
    }
  }

  async function applyBulkPriority() {
    if (!bulkPriority || !selected.size) return;
    try {
      await api.patch(`/projects/${projectId}/tasks/bulk/update`, {
        taskIds: [...selected],
        updates: { priority: bulkPriority },
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success(`Updated priority for ${selected.size} task(s)`);
      setSelected(new Set());
      setBulkPriority('');
    } catch {
      toast.error('Bulk priority update failed');
    }
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} task(s)?`)) return;
    try {
      await Promise.all([...selected].map((id) => api.delete(`/projects/${projectId}/tasks/${id}`)));
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Deleted ${selected.size} task(s)`);
      setSelected(new Set());
    } catch {
      toast.error('Bulk delete failed');
    }
  }

  async function handleExport() {
    try {
      const res = await api.get(`/projects/${projectId}/tasks/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    }
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="p-6 flex-1 overflow-auto page-fade">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks…"
                className="pl-7 pr-7 py-1.5 text-xs border border-gray-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-40 focus:w-52 transition-all"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              <span className="font-bold text-gray-800 dark:text-white">{sortedTasks.length}</span> tasks
            </p>
            {/* My Tasks quick filter */}
            <button
              onClick={() => setFilters((f) => ({ ...f, assignee: f.assignee === user?.id ? undefined : user?.id }))}
              className={cn(
                'text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                filters.assignee === user?.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:border-indigo-300'
              )}
            >
              My Tasks
            </button>
            {/* Status filter */}
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
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
            <div className="flex items-center gap-2 ml-2 flex-wrap">
              {/* Status */}
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
              >
                <option value="">Status…</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
              {bulkStatus && (
                <Button size="sm" onClick={applyBulkStatus}>Apply</Button>
              )}
              {/* Assignee */}
              <select
                value={bulkAssignee}
                onChange={(e) => setBulkAssignee(e.target.value)}
                className="text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
              >
                <option value="">Assign to…</option>
                <option value="__unassign__">Unassign</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {bulkAssignee !== '' && (
                <Button size="sm" onClick={applyBulkAssignee}>Assign</Button>
              )}
              {/* Priority */}
              <select
                value={bulkPriority}
                onChange={(e) => setBulkPriority(e.target.value)}
                className="text-xs border border-indigo-300 dark:border-indigo-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
              >
                <option value="">Priority…</option>
                {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {bulkPriority && (
                <Button size="sm" onClick={applyBulkPriority}>Set</Button>
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-full">
                    <button onClick={() => toggleSort('title')} className="flex items-center hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                      Task <SortIcon col="title" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => toggleSort('status')} className="flex items-center hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                      Status <SortIcon col="status" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => toggleSort('priority')} className="flex items-center hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                      Priority <SortIcon col="priority" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => toggleSort('assignee')} className="flex items-center hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                      Assignee <SortIcon col="assignee" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    <button onClick={() => toggleSort('deadline')} className="flex items-center hover:text-gray-600 dark:hover:text-slate-200 transition-colors">
                      Deadline <SortIcon col="deadline" />
                    </button>
                  </th>
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
                {sortedTasks.map((task) => (
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
                        <span className={cn(
                          'flex items-center gap-1 text-xs',
                          isOverdue(task.deadline) && task.status !== 'done' ? 'text-red-500 font-semibold' :
                          isDueSoon(task.deadline) && task.status !== 'done' ? 'text-amber-500 font-medium' :
                          'text-gray-400 dark:text-slate-500'
                        )}>
                          <Calendar size={12} />{formatDate(task.deadline)}
                          {isDueSoon(task.deadline) && task.status !== 'done' && !isOverdue(task.deadline) && (
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-1 rounded-full font-bold">soon</span>
                          )}
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
