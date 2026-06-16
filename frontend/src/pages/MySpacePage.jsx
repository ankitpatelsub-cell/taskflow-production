import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { cn, formatDate } from '@/lib/utils';
import {
  Plus, Trash2, Check, Lock, Flag, Calendar, ChevronDown, X,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  high:   { color: 'text-red-500',    dot: 'bg-red-400',    label: 'High' },
  medium: { color: 'text-amber-500',  dot: 'bg-amber-400',  label: 'Medium' },
  low:    { color: 'text-green-500',  dot: 'bg-green-400',  label: 'Low' },
};

// ── Inline add-task row ───────────────────────────────────────────────────────

function AddTaskRow({ onAdd }) {
  const [open, setOpen]         = useState(false);
  const [title, setTitle]       = useState('');
  const [notes, setNotes]       = useState('');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate]   = useState('');
  const inputRef = useRef();

  function openRow() { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }

  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), notes: notes.trim() || undefined, priority, due_date: dueDate || undefined });
    setTitle(''); setNotes(''); setPriority('medium'); setDueDate('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancel() {
    setOpen(false); setTitle(''); setNotes(''); setPriority('medium'); setDueDate('');
  }

  if (!open) {
    return (
      <button
        onClick={openRow}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors border-2 border-dashed border-gray-200 hover:border-gray-300"
      >
        <Plus size={15} /> Add a task…
      </button>
    );
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); if (e.key === 'Escape') cancel(); }}
        placeholder="Task name"
        className="w-full text-sm font-medium text-gray-800 bg-transparent outline-none placeholder-gray-300"
      />
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full text-xs text-gray-500 bg-transparent outline-none resize-none placeholder-gray-300"
      />
      <div className="flex items-center gap-3 flex-wrap">
        {/* Priority */}
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
        >
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        {/* Due date */}
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" onClick={cancel}><X size={13} /></Button>
          <Button size="sm" onClick={submit} disabled={!title.trim()}>Add</Button>
        </div>
      </div>
    </div>
  );
}

// ── Single task row ───────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, onDelete, onUpdate }) {
  const [editing, setEditing]   = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

  const isDone = task.status === 'done';
  const isOverdue = task.due_date && !isDone && new Date(task.due_date) < new Date();

  function saveTitle() {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onUpdate(task.id, { title: editTitle.trim() });
    }
    setEditing(false);
  }

  return (
    <div className={cn(
      'group flex items-start gap-3 px-4 py-3 rounded-xl transition-colors',
      isDone ? 'opacity-50' : 'hover:bg-gray-50'
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(task.id, isDone ? 'todo' : 'done')}
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all',
          isDone
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-gray-300 hover:border-indigo-400'
        )}
      >
        {isDone && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full text-sm text-gray-800 bg-transparent outline-none border-b border-indigo-300"
          />
        ) : (
          <p
            onClick={() => !isDone && setEditing(true)}
            className={cn(
              'text-sm cursor-text',
              isDone ? 'line-through text-gray-400' : 'text-gray-800 hover:text-gray-900'
            )}
          >
            {task.title}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className={cn('flex items-center gap-1 text-xs', pc.color)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', pc.dot)} />
            {pc.label}
          </span>
          {task.due_date && (
            <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400')}>
              <Calendar size={10} />
              {isOverdue ? 'Overdue · ' : ''}{formatDate(task.due_date)}
            </span>
          )}
          {task.notes && (
            <span className="text-xs text-gray-300 italic truncate max-w-[200px]" title={task.notes}>{task.notes}</span>
          )}
        </div>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className="mt-0.5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MySpacePage() {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['personal-tasks'],
    queryFn: () => api.get('/me/tasks').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (data) => api.post('/me/tasks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks'] }),
    onError: () => toast.error('Failed to add task'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => api.patch(`/me/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks'] }),
    onError: () => toast.error('Failed to update task'),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/me/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['personal-tasks'] }),
    onError: () => toast.error('Failed to delete task'),
  });

  const clearDone = useMutation({
    mutationFn: () => api.delete('/me/tasks/done'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-tasks'] });
      toast.success('Cleared completed tasks');
    },
    onError: () => toast.error('Failed to clear completed tasks'),
  });

  const todo = tasks.filter(t => t.status === 'todo');
  const done = tasks.filter(t => t.status === 'done');
  const overdueCount = todo.filter(t => t.due_date && new Date(t.due_date) < new Date()).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
          <Lock size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Space</h1>
          <p className="text-xs text-gray-400">Private to you only · not visible to teammates or admins</p>
        </div>
      </div>

      {/* Stats strip */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-4 mb-6 mt-4 text-xs text-gray-400">
          <span>{todo.length} remaining</span>
          {overdueCount > 0 && (
            <span className="text-red-500 font-semibold">⚠ {overdueCount} overdue</span>
          )}
          <span>{done.length} done</span>
        </div>
      )}

      {/* Add task */}
      <div className="mb-4">
        <AddTaskRow onAdd={(data) => create.mutate(data)} />
      </div>

      {/* Todo tasks */}
      {isLoading ? (
        <div className="space-y-2 mt-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Priority groups */}
          {['high', 'medium', 'low'].map(p => {
            const group = todo.filter(t => t.priority === p);
            if (!group.length) return null;
            const pc = PRIORITY_CONFIG[p];
            return (
              <div key={p}>
                <div className="flex items-center gap-2 px-4 py-1.5 mt-3">
                  <span className={cn('w-2 h-2 rounded-full', pc.dot)} />
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{pc.label}</span>
                  <span className="text-xs text-gray-300">{group.length}</span>
                </div>
                {group.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(id, status) => update.mutate({ id, data: { status } })}
                    onDelete={(id) => {
                      if (confirm('Delete this task?')) remove.mutate(id);
                    }}
                    onUpdate={(id, data) => update.mutate({ id, data })}
                  />
                ))}
              </div>
            );
          })}

          {todo.length === 0 && (
            <div className="text-center py-16 text-gray-300">
              <Check size={40} className="mx-auto mb-3 opacity-40" />
              {tasks.length === 0 ? (
                <>
                  <p className="text-sm text-gray-400">Your personal space is empty</p>
                  <p className="text-xs mt-1">Add a task above to get started</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">All to-dos cleared!</p>
                  <p className="text-xs mt-1">Check the completed section below</p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Completed section */}
      {done.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowDone(v => !v)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-2 transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', showDone && 'rotate-180')} />
            {done.length} completed
          </button>
          {showDone && (
            <>
              <div className="space-y-1">
                {done.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={(id, status) => update.mutate({ id, data: { status } })}
                    onDelete={(id) => { if (confirm('Delete this task?')) remove.mutate(id); }}
                    onUpdate={(id, data) => update.mutate({ id, data })}
                  />
                ))}
              </div>
              <button
                onClick={() => { if (confirm('Clear all completed tasks? This cannot be undone.')) clearDone.mutate(); }}
                className="mt-3 text-xs text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <Trash2 size={11} /> Clear all completed
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
