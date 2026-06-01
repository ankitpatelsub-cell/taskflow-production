import { useState } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { useTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, isOverdue, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import { Calendar, Clock, Paperclip, Plus, Trash2, Edit3, X, RefreshCw } from 'lucide-react';
import { CommentThread } from '@/components/comments/CommentThread';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { TaskForm } from './TaskForm';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

const TABS = [
  { id: 'details',  label: 'Details' },
  { id: 'subtasks', label: 'Subtasks' },
  { id: 'comments', label: 'Comments' },
  { id: 'activity', label: 'Activity' },
  { id: 'files',    label: 'Files' },
];

export function TaskDetailDrawer({ projectId, taskId, onClose }) {
  const { data: task, isLoading } = useTask(projectId, taskId);
  const update = useUpdateTask(projectId, taskId);
  const del = useDeleteTask(projectId);
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

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
            <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50/50 shrink-0">
              <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', STATUS_COLORS[task.status])}>
                {STATUS_LABELS[task.status]}
              </span>
              <PriorityBadge priority={task.priority} />
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Edit3 size={13} /> Edit
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
                  {/* Assignee */}
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assignee</p>
                    {task.assignee_id ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={task.assignee_name} size="sm" />
                        <span className="text-sm font-medium text-gray-800">{task.assignee_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </div>

                  {/* Deadline */}
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Deadline</p>
                    {task.deadline ? (
                      <div className={cn('flex items-center gap-1.5 text-sm font-medium', overdue ? 'text-red-600' : 'text-gray-800')}>
                        <Calendar size={14} />
                        {formatDate(task.deadline)}
                        {overdue && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">OVERDUE</span>}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not set</span>
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

                  {/* Created by */}
                  <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Created</p>
                    <p className="text-sm text-gray-700">{formatDate(task.created_at)}</p>
                  </div>
                </div>

                {/* Description */}
                {task.description && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                  </div>
                )}

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
                      {task.recurrence_rule && (
                        <div className="flex items-start gap-2 mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
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
                              <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                                Ends on {formatDate(task.recurrence_ends_at)}
                              </p>
                            )}
                            {task.recurrence_parent_id && (
                              <p className="text-xs text-indigo-400 mt-0.5">Part of a recurring series</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'subtasks' && (
                    <div className="space-y-2">
                      {task.subtasks?.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                            s.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                          )}>
                            {s.status === 'done' && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={cn('text-sm flex-1', s.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800')}>
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

                  {tab === 'comments' && <CommentThread taskId={taskId} />}
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
