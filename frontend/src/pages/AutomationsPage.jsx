import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { Button } from '@/components/ui/Button';
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TRIGGER_LABELS = {
  task_status_changed: 'Task status changes',
  task_created:        'Task is created',
  task_assigned:       'Task is assigned',
};

const ACTION_LABELS = {
  notify_assignee: 'Notify assignee',
  notify_members:  'Notify all members',
  change_status:   'Change status to',
  notify_slack:    'Post to Slack',
};

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const STATUS_LABELS_MAP = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

export function AutomationsPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    trigger_type:  'task_status_changed',
    trigger_value: '',
    action_type:   'notify_assignee',
    action_value:  '',
  });

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations', projectId],
    queryFn: () => api.get(`/projects/${projectId}/automations`).then(r => r.data),
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post(`/projects/${projectId}/automations`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations', projectId] });
      setCreating(false);
      setForm({ trigger_type: 'task_status_changed', trigger_value: '', action_type: 'notify_assignee', action_value: '' });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }) => api.patch(`/projects/${projectId}/automations/${id}`, { is_active }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations', projectId] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/projects/${projectId}/automations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automations', projectId] }),
  });

  function handleCreate(e) {
    e.preventDefault();
    createMut.mutate(form);
  }

  function triggerSummary(a) {
    let t = TRIGGER_LABELS[a.trigger_type] || a.trigger_type;
    if (a.trigger_value) t += ` → "${STATUS_LABELS_MAP[a.trigger_value] || a.trigger_value}"`;
    return t;
  }

  function actionSummary(a) {
    let ac = ACTION_LABELS[a.action_type] || a.action_type;
    if (a.action_type === 'change_status' && a.action_value) {
      ac += ` "${STATUS_LABELS_MAP[a.action_value] || a.action_value}"`;
    }
    return ac;
  }

  return (
    <div className="flex flex-col h-full">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap size={20} className="text-amber-500" />
                Automations
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Automate repetitive work with "When X → Then Y" rules.
              </p>
            </div>
            {!creating && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={14} /> New rule
              </Button>
            )}
          </div>

          {/* Create form */}
          {creating && (
            <form
              onSubmit={handleCreate}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-indigo-200 dark:border-indigo-700 p-5 mb-5 shadow-sm"
            >
              <p className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-4">New automation rule</p>

              {/* Trigger row */}
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide w-10 shrink-0">When</span>
                <select
                  value={form.trigger_type}
                  onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value, trigger_value: '' }))}
                  className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {form.trigger_type === 'task_status_changed' && (
                  <select
                    value={form.trigger_value}
                    onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                    className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">any status</option>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS_MAP[s]}</option>)}
                  </select>
                )}
              </div>

              {/* Action row */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide w-10 shrink-0">Then</span>
                <select
                  value={form.action_type}
                  onChange={e => setForm(f => ({ ...f, action_type: e.target.value, action_value: '' }))}
                  className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Object.entries(ACTION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {form.action_type === 'change_status' && (
                  <select
                    value={form.action_value}
                    onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                    className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">select status…</option>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS_MAP[s]}</option>)}
                  </select>
                )}
                {form.action_type === 'notify_slack' && (
                  <input
                    type="text"
                    placeholder="Optional custom message…"
                    value={form.action_value}
                    onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                    className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
                  />
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button type="submit" loading={createMut.isPending}>Save rule</Button>
                <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
              {createMut.isError && (
                <p className="text-xs text-red-500 mt-2">
                  {createMut.error?.response?.data?.error || 'Failed to save rule'}
                </p>
              )}
            </form>
          )}

          {/* List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : automations.length === 0 && !creating ? (
            <div className="text-center py-16 text-gray-400">
              <Zap size={32} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No automations yet</p>
              <p className="text-sm mt-1">Create rules to automate repetitive actions.</p>
              <Button className="mt-4" variant="secondary" onClick={() => setCreating(true)}>
                <Plus size={14} /> Create first rule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map(a => (
                <div
                  key={a.id}
                  className={cn(
                    'bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center gap-4 transition-opacity',
                    !a.is_active && 'opacity-55'
                  )}
                >
                  <Zap size={16} className={cn('shrink-0', a.is_active ? 'text-amber-500' : 'text-gray-300')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold whitespace-nowrap">
                        {triggerSummary(a)}
                      </span>
                      <ChevronRight size={12} className="text-gray-400 shrink-0" />
                      <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-semibold whitespace-nowrap">
                        {actionSummary(a)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      By {a.created_by_name || 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMut.mutate({ id: a.id, is_active: !a.is_active })}
                    className={cn('shrink-0 transition-colors', a.is_active ? 'text-indigo-500' : 'text-gray-300')}
                    title={a.is_active ? 'Disable' : 'Enable'}
                  >
                    {a.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button
                    onClick={() => deleteMut.mutate(a.id)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
