import { useForm, useWatch } from 'react-hook-form';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useProjectMembers } from '@/hooks/useProjects';
import { useProjectStatuses } from '@/hooks/useProjectStatuses';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

const WEEKDAYS = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

function useSimilarTasks(projectId, title) {
  const [similar, setSimilar] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!projectId || !title || title.trim().length < 4) { setSimilar([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/projects/${projectId}/tasks/similar`, { params: { title } });
        setSimilar(res.data || []);
      } catch { setSimilar([]); }
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [projectId, title]);

  return similar;
}

export function TaskForm({ projectId, defaultValues = {}, onSubmit, onCancel, loading }) {
  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm({
    defaultValues: {
      ...defaultValues,
      recurrence_rule:     defaultValues.recurrence_rule     ?? '',
      recurrence_interval: defaultValues.recurrence_interval ?? 1,
      recurrence_days:     defaultValues.recurrence_days     ?? '',
      recurrence_ends_at:  defaultValues.recurrence_ends_at  ?? '',
    },
  });

  const recurrenceRule = useWatch({ control, name: 'recurrence_rule' });
  const recurrenceDays = useWatch({ control, name: 'recurrence_days' });
  const titleValue = useWatch({ control, name: 'title' });
  const similarTasks = useSimilarTasks(projectId, titleValue);
  // Parse existing days for the checkbox state
  const existingDays = (() => {
    try { return JSON.parse(defaultValues.recurrence_days || '[]'); } catch { return []; }
  })();

  const { data: members = [] } = useProjectMembers(projectId);
  const { data: statuses = [] } = useProjectStatuses(projectId);

  function handleDayToggle(day, checked, currentVal) {
    const current = (() => { try { return JSON.parse(currentVal || '[]'); } catch { return []; } })();
    const next = checked ? [...new Set([...current, day])].sort((a, b) => a - b) : current.filter((d) => d !== day);
    setValue('recurrence_days', next.length ? JSON.stringify(next) : '');
  }

  function handleSubmitWrapper(data) {
    const out = { ...data };
    // Coerce empty strings to null for recurrence fields
    if (!out.recurrence_rule) {
      out.recurrence_rule    = null;
      out.recurrence_interval = 1;
      out.recurrence_days    = null;
      out.recurrence_ends_at = null;
    } else {
      out.recurrence_interval = Number(out.recurrence_interval) || 1;
      out.recurrence_days    = out.recurrence_days || null;
      out.recurrence_ends_at = out.recurrence_ends_at || null;
    }
    onSubmit(out);
  }

  return (
    <form onSubmit={handleSubmit(handleSubmitWrapper)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title *</label>
        <Input {...register('title', { required: true })} placeholder="Task title" />
        {errors.title && <p className="text-xs text-red-500 mt-1">Title is required</p>}
        {similarTasks.length > 0 && !defaultValues.id && (
          <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1.5">
              <AlertTriangle size={12} /> Similar tasks already exist
            </div>
            <ul className="space-y-1">
              {similarTasks.map((t) => (
                <li key={t.id} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <span className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium capitalize',
                    t.status === 'todo' ? 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300' :
                    t.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                    'bg-amber-200 dark:bg-amber-900/40 text-amber-700'
                  )}>{t.status.replace('_', ' ')}</span>
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-xl border border-gray-300 dark:border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white"
          placeholder="Task description..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Priority</label>
          <Select {...register('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Status</label>
          <Select {...register('status')}>
            {statuses.length > 0
              ? statuses.map(s => <option key={s.key} value={s.key}>{s.name}</option>)
              : <>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </>
            }
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Assignee</label>
          <Select {...register('assignee_id')}>
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Deadline</label>
          <Input type="date" {...register('deadline')} />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Estimated hours</label>
          <Input type="number" step="0.5" {...register('estimated_hours')} placeholder="e.g. 4" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Story Points</label>
          <input
            type="number"
            min="1"
            max="100"
            placeholder="—"
            {...register('story_points', { valueAsNumber: true })}
            className="w-24 border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* ── Recurrence ──────────────────────────────────────────────────────── */}
      <div className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 space-y-3 bg-gray-50/50 dark:bg-slate-700/30">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">Repeat</span>
        </div>

        {/* Rule */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Repeat</label>
            <Select {...register('recurrence_rule')}>
              <option value="">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>

          {recurrenceRule && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">
                Every
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={1}
                  max={365}
                  {...register('recurrence_interval')}
                  className="w-16 text-center"
                />
                <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                  {recurrenceRule === 'daily'   ? 'day(s)'   :
                   recurrenceRule === 'weekly'  ? 'week(s)'  : 'month(s)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Days of week (weekly only) */}
        {recurrenceRule === 'weekly' && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">On days</label>
            <input type="hidden" {...register('recurrence_days')} />
            <div className="flex gap-1 flex-wrap">
              {WEEKDAYS.map(({ label, value }) => {
                const active = (() => {
                  try { return JSON.parse(recurrenceDays || '[]').includes(value); }
                  catch { return existingDays.includes(value); }
                })();
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleDayToggle(value, !active, recurrenceDays)}
                    className={cn(
                      'w-9 h-9 rounded-xl text-xs font-semibold border transition-colors',
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-indigo-400'
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ends on (optional) */}
        {recurrenceRule && (
          <div>
            <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Ends on (optional)</label>
            <Input type="date" {...register('recurrence_ends_at')} className="max-w-xs" />
            <p className="text-xs text-gray-400 mt-1">Leave empty to repeat indefinitely</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Task'}</Button>
      </div>
    </form>
  );
}
