import { useState, useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { useProject } from '@/hooks/useProjects';
import { useEpics, useCreateEpic, useDeleteEpic, useUpdateEpic } from '@/hooks/useEpics';
import { ProjectNav } from './ProjectNav';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate, STATUS_COLORS, STATUS_LABELS } from '@/lib/utils';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  ChevronLeft,
  Calendar,
  Flag,
} from 'lucide-react';
import { addDays, format, startOfWeek, differenceInDays, parseISO, isValid } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_COUNT = 12;

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
];

const EPIC_STATUS_COLORS = {
  active:    'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  archived:  'bg-gray-100 text-gray-500',
};

// ─── Timeline bar ─────────────────────────────────────────────────────────────

function EpicTimelineBar({ epic, viewStart, totalDays }) {
  const start = epic.start_date ? parseISO(epic.start_date.slice(0, 10)) : null;
  const end   = epic.end_date   ? parseISO(epic.end_date.slice(0, 10))   : null;

  if (!start || !isValid(start)) return null;

  const effectiveEnd = end && isValid(end) ? end : addDays(start, 6);

  const offsetDays = differenceInDays(start, viewStart);
  const spanDays   = Math.max(1, differenceInDays(effectiveEnd, start) + 1);

  if (offsetDays >= totalDays || offsetDays + spanDays < 0) return null;

  const clampedOffset = Math.max(0, offsetDays);
  const clampedSpan   = Math.min(spanDays - (clampedOffset - offsetDays), totalDays - clampedOffset);

  const leftPct  = (clampedOffset / totalDays) * 100;
  const widthPct = (clampedSpan   / totalDays) * 100;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full flex items-center px-2 text-[10px] font-semibold text-white truncate shadow-sm cursor-default"
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        minWidth: '6px',
        backgroundColor: epic.color || '#6366f1',
        opacity: epic.status === 'archived' ? 0.5 : 1,
      }}
      title={`${epic.title}${start ? ' · ' + format(start, 'MMM d') : ''}${end ? ' – ' + format(end, 'MMM d') : ''}`}
    >
      {widthPct > 6 ? epic.title : ''}
    </div>
  );
}

// ─── New Epic Form ─────────────────────────────────────────────────────────────

function NewEpicModal({ open, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    color: PRESET_COLORS[0],
    start_date: '',
    end_date: '',
  });

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({ ...form, start_date: form.start_date || null, end_date: form.end_date || null });
  }

  return (
    <Modal open={open} onClose={onClose} title="New Epic">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Title <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            required
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Epic title…"
            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="What is this epic about?"
            className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Color
          </label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set('color', c)}
                className={cn(
                  'w-7 h-7 rounded-full border-2 transition-transform',
                  form.color === c ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              End Date
            </label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => set('end_date', e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!form.title.trim()}>
            <Flag size={14} /> Create Epic
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Epic Card ────────────────────────────────────────────────────────────────

function EpicCard({ epic, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false);

  const taskCount = epic.task_count ?? 0;
  const doneCount = epic.done_count ?? 0;
  const progress  = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Colored left border accent */}
      <div className="flex">
        <div className="w-1 shrink-0 rounded-l-xl" style={{ backgroundColor: epic.color || '#6366f1' }} />

        <div className="flex-1 p-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 truncate">{epic.title}</span>
                <span
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded-full font-semibold',
                    EPIC_STATUS_COLORS[epic.status] || EPIC_STATUS_COLORS.active
                  )}
                >
                  {epic.status || 'active'}
                </span>
              </div>

              {epic.description && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{epic.description}</p>
              )}

              {/* Progress + dates row */}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {/* Progress bar */}
                <div className="flex items-center gap-2 min-w-[120px]">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: epic.color || '#6366f1',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                    {doneCount}/{taskCount} done
                  </span>
                </div>

                {/* Date range */}
                {(epic.start_date || epic.end_date) && (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={12} />
                    {epic.start_date ? formatDate(epic.start_date) : '—'}
                    <span>→</span>
                    {epic.end_date ? formatDate(epic.end_date) : '—'}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={epic.status || 'active'}
                onChange={(e) => onUpdate(epic.id, { status: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <button
                onClick={() => {
                  if (confirm(`Delete epic "${epic.title}"? This cannot be undone.`)) {
                    onDelete(epic.id);
                  }
                }}
                className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Delete epic"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Expanded: task list */}
          {expanded && (
            <div className="mt-3 ml-6 space-y-1.5">
              {epic.tasks?.length > 0 ? (
                epic.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <span
                      className={cn(
                        'text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0',
                        STATUS_COLORS[task.status]
                      )}
                    >
                      {STATUS_LABELS[task.status] || task.status}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 truncate">{task.title}</span>
                    {task.assignee_name && (
                      <Avatar name={task.assignee_name} size="sm" />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 italic py-1">No tasks assigned to this epic yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EpicsPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: epicsRaw = [], isLoading } = useEpics(projectId);
  const createEpic = useCreateEpic(projectId);
  const deleteEpic = useDeleteEpic(projectId);
  // epicId is not known at render time; we pass it inside mutate() as { epicId, ...data }
  const updateEpic = useUpdateEpic(projectId);

  const [showNew, setShowNew] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Normalise: backend may return array or { epics: [...] }
  const epics = Array.isArray(epicsRaw) ? epicsRaw : (epicsRaw?.epics ?? []);

  // ── Timeline helpers ──────────────────────────────────────────────────────
  const viewStart = useMemo(() => {
    const base = startOfWeek(new Date(), { weekStartsOn: 1 });
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const totalDays = WEEK_COUNT * 7;
  const viewEnd   = addDays(viewStart, totalDays - 1);

  const weeks = useMemo(
    () =>
      Array.from({ length: WEEK_COUNT }, (_, i) => ({
        label: format(addDays(viewStart, i * 7), 'MMM d'),
        days: 7,
      })),
    [viewStart]
  );

  const today        = new Date();
  const todayOffset  = differenceInDays(today, viewStart);
  const todayPct     = (todayOffset / totalDays) * 100;
  const showToday    = todayOffset >= 0 && todayOffset < totalDays;

  // Epics that have at least a start_date (needed for timeline display)
  const timelineEpics = epics.filter((e) => e.start_date);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleCreate(data) {
    createEpic.mutate(data, { onSuccess: () => setShowNew(false) });
  }

  function handleDelete(epicId) {
    deleteEpic.mutate(epicId);
  }

  function handleUpdate(epicId, data) {
    updateEpic.mutate({ epicId, ...data });
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 space-y-6 max-w-5xl mx-auto">

          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Epics &amp; Roadmap</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Group related tasks into epics and visualise your roadmap.
              </p>
            </div>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Epic
            </Button>
          </div>

          {/* ── Epic cards ── */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white rounded-xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : epics.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <div className="text-4xl mb-3">🚀</div>
              <p className="font-semibold text-gray-500">No epics yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first epic to organise and track larger bodies of work.
              </p>
              <Button className="mt-4" onClick={() => setShowNew(true)}>
                <Plus size={14} /> New Epic
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {epics.map((epic) => (
                <EpicCard
                  key={epic.id}
                  epic={epic}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}

          {/* ── Gantt-style timeline ── */}
          {timelineEpics.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Timeline</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(viewStart, 'MMM d')} – {format(viewEnd, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setWeekOffset((w) => w - WEEK_COUNT)}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    title="Previous period"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={() => setWeekOffset(0)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setWeekOffset((w) => w + WEEK_COUNT)}
                    className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                    title="Next period"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex">
                  {/* Epic name column */}
                  <div className="w-48 shrink-0 border-r border-gray-200">
                    <div className="h-9 border-b border-gray-200 px-3 flex items-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Epic</span>
                    </div>
                    {timelineEpics.map((epic) => (
                      <div
                        key={epic.id}
                        className="h-10 px-3 flex items-center gap-2 border-b border-gray-50 last:border-0"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: epic.color || '#6366f1' }}
                        />
                        <span className="text-xs text-gray-800 truncate" title={epic.title}>
                          {epic.title}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Timeline column */}
                  <div className="flex-1 overflow-x-auto relative">
                    {/* Week headers */}
                    <div className="h-9 border-b border-gray-200 flex">
                      {weeks.map((w, i) => (
                        <div
                          key={i}
                          className="shrink-0 flex items-center justify-center border-r border-gray-100 last:border-0"
                          style={{ width: `${(w.days / totalDays) * 100}%`, minWidth: `${w.days * 12}px` }}
                        >
                          <span className="text-[10px] font-semibold text-gray-400 uppercase">{w.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Epic rows */}
                    {timelineEpics.map((epic) => (
                      <div
                        key={epic.id}
                        className="h-10 border-b border-gray-50 last:border-0 relative"
                      >
                        {/* Week grid lines */}
                        {weeks.map((_, wi) => (
                          <div
                            key={wi}
                            className="absolute top-0 bottom-0 border-r border-gray-100"
                            style={{ left: `${(wi * 7 / totalDays) * 100}%` }}
                          />
                        ))}

                        {/* Today marker */}
                        {showToday && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-red-300 z-10"
                            style={{ left: `${todayPct}%` }}
                          />
                        )}

                        <EpicTimelineBar
                          epic={epic}
                          viewStart={viewStart}
                          totalDays={totalDays}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Epic modal */}
      <NewEpicModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSubmit={handleCreate}
        loading={createEpic.isPending}
      />
    </div>
  );
}
