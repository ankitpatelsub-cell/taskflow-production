import { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { useTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { useProjectMembers } from '@/hooks/useProjects';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Clock, Paperclip, Plus, Trash2, Edit3, X, RefreshCw, Timer, Link2, Check, Bell, GitBranch, Copy, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { CommentThread } from '@/components/comments/CommentThread';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { TimeTracker } from './TimeTracker';
import { TaskLinks } from './TaskLinks';
import { TaskForm } from './TaskForm';
import { TaskDependencies } from './TaskDependencies';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import { AITaskPanel } from './AITaskPanel';
import { MarkdownContent } from '@/components/shared/MarkdownContent';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/ui/Toast';

const TABS = [
  { id: 'details',      label: 'Details' },
  { id: 'subtasks',     label: 'Subtasks' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'ai',          label: 'AI' },
  { id: 'fields',      label: 'Fields' },
  { id: 'comments',    label: 'Comments' },
  { id: 'time',         label: 'Time' },
  { id: 'links',        label: 'Links' },
  { id: 'activity',     label: 'Activity' },
  { id: 'files',        label: 'Files' },
];

export function TaskDetailDrawer({ projectId, taskId, onClose }) {
  const { t } = useTranslation();
  const { data: task, isLoading } = useTask(projectId, taskId);
  const update = useUpdateTask(projectId, taskId);
  const del = useDeleteTask(projectId);
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [togglingSubtask, setTogglingSubtask] = useState(null);
  // Single field tracks which meta card is being edited (prevents simultaneous open editors)
  const [editingField, setEditingField] = useState(null); // 'priority' | 'assignee' | 'deadline'

  const { data: members = [] } = useProjectMembers(projectId);

  if (isLoading) {
    return (
      <Drawer open onClose={onClose} title="Loading…" wide>
        <div className="p-6 space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </Drawer>
    );
  }
  if (!task) return null;

  function handleUpdate(data) {
    update.mutate(data, { onSuccess: () => setEditing(false) });
  }

  function handleDelete() {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    del.mutate(taskId, { onSuccess: onClose });
  }

  async function handleDuplicate() {
    try {
      const { title, description, status, priority, assignee_id, deadline } = task;
      await api.post(`/projects/${projectId}/tasks`, {
        title: `${title} (copy)`, description, status, priority, assignee_id, deadline,
      });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task duplicated');
    } catch {
      toast.error('Failed to duplicate task');
    }
  }

  function startEditDesc() {
    setDescDraft(task.description || '');
    setEditingDesc(true);
  }

  function saveDesc() {
    update.mutate({ description: descDraft }, { onSuccess: () => setEditingDesc(false) });
  }

  function cancelDesc() {
    setEditingDesc(false);
    setDescDraft('');
  }

  async function toggleSubtask(subtask) {
    setTogglingSubtask(subtask.id);
    try {
      const newStatus = subtask.status === 'done' ? 'todo' : 'done';
      await api.patch(`/projects/${projectId}/tasks/${subtask.id}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId, taskId] });
    } finally {
      setTogglingSubtask(null);
    }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return;
    await api.post(`/projects/${projectId}/tasks`, { title: newSubtask.trim(), parent_task_id: taskId });
    setNewSubtask('');
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId, taskId] });
  }

  const overdue = task.deadline && isOverdue(task.deadline) && task.status !== 'done';

  return (
    <Drawer open onClose={onClose} title={task.title} wide>
      <div className="flex flex-col h-full">
        {editing ? (
          <div className="p-6">
            <TaskForm
              projectId={projectId}
              defaultValues={{
                ...task,
                deadline:            task.deadline?.slice(0, 10),
                recurrence_ends_at:  task.recurrence_ends_at?.slice(0, 10),
                assignee_id:         task.assignee_id         || '',
                recurrence_rule:     task.recurrence_rule     || '',
                recurrence_interval: task.recurrence_interval || 1,
                recurrence_days:     task.recurrence_days     || '',
              }}
              onSubmit={handleUpdate}
              onCancel={() => setEditing(false)}
              loading={update.isPending}
            />
          </div>
        ) : (
          <>
            {/* Action bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 shrink-0 flex-wrap">
              {/* Quick status change */}
              <div className="flex items-center gap-1 flex-wrap">
                {Object.entries(STATUS_LABELS).map(([s, label]) => (
                  <button
                    key={s}
                    onClick={() => task.status !== s && update.mutate({ status: s })}
                    disabled={update.isPending}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-semibold transition-all border',
                      task.status === s
                        ? cn(STATUS_COLORS[s], 'shadow-sm scale-105 border-transparent')
                        : 'text-gray-400 dark:text-slate-500 bg-transparent border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {editingField === 'priority' ? (
                <select
                  autoFocus
                  value={task.priority || 'medium'}
                  onBlur={() => setEditingField(null)}
                  onChange={(e) => { update.mutate({ priority: e.target.value }); setEditingField(null); }}
                  className="text-xs border border-indigo-300 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none"
                >
                  {['low','medium','high','critical'].map(p => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
                </select>
              ) : (
                <button onClick={() => setEditingField('priority')} title="Click to change priority" className="hover:scale-105 transition-transform">
                  <PriorityBadge priority={task.priority} />
                </button>
              )}
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Edit3 size={13} /> Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDuplicate} title="Duplicate task">
                <Copy size={13} />
              </Button>
              <div className="w-px h-5 bg-gray-200 dark:bg-slate-600" />
              <Button size="sm" variant="danger" onClick={handleDelete} title="Delete task">
                <Trash2 size={13} />
              </Button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto">
              {/* Meta cards */}
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Assignee — click to edit */}
                  <div
                    className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-slate-600 cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => editingField !== 'assignee' && setEditingField('assignee')}
                    title="Click to change assignee"
                  >
                    <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wide mb-2">{t('task.assignee')}</p>
                    {editingField === 'assignee' ? (
                      <select
                        autoFocus
                        value={task.assignee_id || ''}
                        onBlur={() => setEditingField(null)}
                        onChange={(e) => {
                          update.mutate({ assignee_id: e.target.value || null });
                          setEditingField(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-indigo-300 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">{t('task.unassigned')}</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : task.assignee_id ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.assignee_name} size="sm" />
                        <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{task.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-slate-500">{t('task.unassigned')}</span>
                    )}
                  </div>

                  {/* Deadline — click to edit */}
                  <div
                    className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-slate-600 cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => editingField !== 'deadline' && setEditingField('deadline')}
                    title="Click to change deadline"
                  >
                    <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wide mb-2">{t('task.deadline')}</p>
                    {editingField === 'deadline' ? (
                      <input
                        type="date"
                        autoFocus
                        defaultValue={task.deadline?.slice(0, 10) ?? ''}
                        key={task.deadline?.slice(0, 10) ?? ''}
                        onBlur={(e) => {
                          if (e.target.value !== (task.deadline?.slice(0, 10) ?? '')) {
                            update.mutate({ deadline: e.target.value || null });
                          }
                          setEditingField(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-sm border border-indigo-300 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : task.deadline ? (
                      <div className={cn('flex items-center gap-1.5 text-sm font-medium', overdue ? 'text-red-600' : 'text-gray-800 dark:text-slate-200')}>
                        <Calendar size={14} />
                        {formatDate(task.deadline)}
                        {overdue && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">{t('task.overdue')}</span>}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-slate-500">{t('task.notSet')}</span>
                    )}
                  </div>

                  {/* Reminder — click to edit */}
                  <div
                    className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-3.5 border border-gray-100 dark:border-slate-600 cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => editingField !== 'reminder' && setEditingField('reminder')}
                    title={t('task.setReminder')}
                  >
                    <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wide mb-2">{t('task.reminder')}</p>
                    {editingField === 'reminder' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="datetime-local"
                          autoFocus
                          key={task.reminder_at?.slice(0, 16) ?? 'empty'}
                          defaultValue={task.reminder_at ? new Date(task.reminder_at).toISOString().slice(0, 16) : ''}
                          min={new Date().toISOString().slice(0, 16)}
                          onBlur={(e) => {
                            const newVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                            const oldVal = task.reminder_at ?? null;
                            if (newVal !== oldVal) update.mutate({ reminder_at: newVal });
                            setEditingField(null);
                          }}
                          className="flex-1 text-sm border border-indigo-300 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {task.reminder_at && (
                          <button
                            onClick={() => { update.mutate({ reminder_at: null }); setEditingField(null); }}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            title={t('task.clearReminder')}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ) : task.reminder_at ? (
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          <Bell size={13} />
                          {format(new Date(task.reminder_at), 'MMM d, h:mm a')}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); update.mutate({ reminder_at: null }); }}
                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5 shrink-0"
                          title={t('task.clearReminder')}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-slate-500">{t('task.notSet')}</span>
                    )}
                  </div>

                  {/* Estimate */}
                  {task.estimated_hours && (
                    <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estimate</p>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <Clock size={14} className="text-gray-400" />
                        {task.estimated_hours}h
                      </div>
                    </div>
                  )}

                  {/* Story Points */}
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Story Points</p>
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-indigo-400" />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        defaultValue={task.story_points || ''}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          if (val !== task.story_points) update.mutate({ story_points: val });
                        }}
                        className="w-16 text-sm font-medium text-gray-800 dark:text-white bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                      />
                    </div>
                  </div>

                  {/* Created by */}
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Created</p>
                    <p className="text-sm text-gray-700">{formatDate(task.created_at)}</p>
                  </div>
                </div>

                {/* Description — inline editable */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 dark:bg-slate-700/50 dark:border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wide">Description</p>
                    {!editingDesc && (
                      <button
                        onClick={startEditDesc}
                        className="text-xs text-gray-400 hover:text-indigo-600 transition-colors flex items-center gap-0.5"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    )}
                  </div>
                  {editingDesc ? (
                    <div>
                      <textarea
                        autoFocus
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') cancelDesc();
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDesc();
                        }}
                        rows={4}
                        placeholder="Add a description…"
                        className="w-full text-sm text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-indigo-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={saveDesc}
                          disabled={update.isPending}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          <Check size={11} /> Save
                        </button>
                        <button onClick={cancelDesc} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                          Cancel
                        </button>
                        <span className="text-xs text-gray-300 ml-auto">⌘↵ to save · Esc to cancel</span>
                      </div>
                    </div>
                  ) : task.description ? (
                    <div className="cursor-text" onClick={startEditDesc}>
                      <MarkdownContent content={task.description} />
                    </div>
                  ) : (
                    <p
                      className="text-sm text-gray-400 dark:text-slate-500 italic cursor-pointer hover:text-indigo-500 transition-colors"
                      onClick={startEditDesc}
                    >
                      Click to add a description…
                    </p>
                  )}
                </div>

                {/* Tags */}
                {task.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs px-2.5 py-1 rounded-full font-medium border"
                        style={{ backgroundColor: t.color + '20', color: t.color, borderColor: t.color + '40' }}
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Subtask progress bar */}
                {task.subtasks?.length > 0 && (() => {
                  const done = task.subtasks.filter((s) => s.status === 'done').length;
                  const pct = Math.round((done / task.subtasks.length) * 100);
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                          Subtasks {done}/{task.subtasks.length}
                        </span>
                        <span className="text-xs font-bold text-gray-600 dark:text-slate-300">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Recurrence badge — always visible when set */}
                {task.recurrence_rule && (
                  <div className="flex items-start gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <RefreshCw size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-0.5">Recurring task</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Repeats <strong>{task.recurrence_rule}</strong>
                        {task.recurrence_interval > 1 && ` every ${task.recurrence_interval}`}
                        {task.recurrence_rule === 'weekly' && task.recurrence_days && (() => {
                          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                          try {
                            const d = JSON.parse(task.recurrence_days).map((n) => days[n]).join(', ');
                            return ` on ${d}`;
                          } catch { return ''; }
                        })()}
                      </p>
                      {task.recurrence_ends_at && (
                        <p className="text-xs text-indigo-500 mt-0.5">Ends on {formatDate(task.recurrence_ends_at)}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="border-b border-gray-100 -mx-6 px-6 pt-2">
                  <div className="flex gap-0 -mb-px overflow-x-auto">
                    {TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                          'px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors shrink-0',
                          tab === t.id
                            ? 'border-indigo-600 text-indigo-700'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        )}
                      >
                        {t.label}
                        {t.id === 'comments' && task.comments?.length > 0 && (
                          <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
                            {task.comments.length}
                          </span>
                        )}
                        {t.id === 'subtasks' && task.subtasks?.length > 0 && (
                          <span className="ml-1.5 bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
                            {task.subtasks.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div className="min-h-[120px]">
                  {tab === 'details' && (
                    <div className="text-sm text-gray-500 dark:text-slate-400 space-y-2">
                      <p>Created by <strong className="text-gray-700 dark:text-slate-200">{task.creator_name || 'Unknown'}</strong></p>
                      <p>Last updated <strong className="text-gray-700 dark:text-slate-200">{formatDate(task.updated_at)}</strong></p>
                      {task.recurrence_parent_id && (
                        <p className="text-xs text-indigo-400">Part of a recurring series</p>
                      )}
                    </div>
                  )}

                  {tab === 'subtasks' && (
                    <div className="space-y-2">
                      {task.subtasks?.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                          <button
                            onClick={() => toggleSubtask(s)}
                            disabled={togglingSubtask === s.id}
                            className={cn(
                              'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                              s.status === 'done'
                                ? 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600'
                                : 'border-gray-300 dark:border-slate-500 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            )}
                            title={s.status === 'done' ? 'Mark incomplete' : 'Mark done'}
                          >
                            {s.status === 'done' && <Check size={10} className="text-white" />}
                          </button>
                          <span className={cn('text-sm flex-1 dark:text-slate-200', s.status === 'done' ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800')}>
                            {s.title}
                          </span>
                          <PriorityBadge priority={s.priority} />
                        </div>
                      ))}
                      <div className="flex gap-2 mt-3">
                        <input
                          value={newSubtask}
                          onChange={(e) => setNewSubtask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                          placeholder="Add subtask… (Enter to save)"
                          className="flex-1 text-sm border border-gray-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                        />
                        <Button size="sm" onClick={addSubtask}><Plus size={14} /></Button>
                      </div>
                    </div>
                  )}

                  {tab === 'dependencies' && <TaskDependencies taskId={taskId} projectId={projectId} />}
                  {tab === 'ai'     && <AITaskPanel projectId={projectId} taskId={taskId} task={task} />}
                  {tab === 'fields' && <CustomFieldsPanel projectId={projectId} taskId={taskId} />}
                  {tab === 'comments' && <CommentThread taskId={taskId} />}
                  {tab === 'time'     && <TimeTracker taskId={taskId} />}
                  {tab === 'links'    && <TaskLinks taskId={taskId} />}
                  {tab === 'activity' && <ActivityFeed items={task.activity || []} />}

                  {tab === 'files' && (
                    <div className="space-y-2">
                      {task.attachments?.map((a) => (
                        <a
                          key={a.id}
                          href={`/api/tasks/${taskId}/attachments/${a.id}`}
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                        >
                          <Paperclip size={15} className="text-indigo-400 shrink-0" />
                          <span className="text-sm text-gray-800 flex-1 truncate">{a.filename}</span>
                          <span className="text-xs text-gray-400 shrink-0">{(a.filesize / 1024).toFixed(1)} KB</span>
                        </a>
                      ))}
                      {!task.attachments?.length && (
                        <p className="text-sm text-gray-400 text-center py-4">No files attached</p>
                      )}
                      <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                        <Plus size={15} /> Upload file
                        <input type="file" className="hidden" onChange={async (e) => {
                          const f = e.target.files[0]; if (!f) return;
                          const fd = new FormData(); fd.append('file', f);
                          await api.post(`/tasks/${taskId}/attachments`, fd);
                          queryClient.invalidateQueries({ queryKey: ['tasks', projectId, taskId] });
                        }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
