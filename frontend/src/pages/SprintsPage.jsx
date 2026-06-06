import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { Plus, Play, CheckCheck, Trash2, Target, CalendarDays, ListChecks } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import {
  useSprints,
  useCreateSprint,
  useStartSprint,
  useCompleteSprint,
  useDeleteSprint,
} from '@/hooks/useSprints';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ProjectNav } from './ProjectNav';
import { cn, formatDate } from '@/lib/utils';
import { hasMinRole } from '@/lib/roles';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  planning:  { label: 'Planning',  class: 'bg-gray-100 text-gray-600' },
  active:    { label: 'Active',    class: 'bg-emerald-100 text-emerald-700' },
  completed: { label: 'Completed', class: 'bg-blue-100 text-blue-700' },
};

function SprintStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.planning;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.class)}>
      {cfg.label}
    </span>
  );
}

// ── Task progress bar ─────────────────────────────────────────────────────────
function TaskProgress({ done = 0, total = 0 }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 shrink-0">
        {done}/{total}
      </span>
    </div>
  );
}

// ── Sprint card ───────────────────────────────────────────────────────────────
function SprintCard({ sprint, projectId, canWrite, onNavigate }) {
  const startMutation    = useStartSprint(projectId, sprint.id);
  const completeMutation = useCompleteSprint(projectId, sprint.id);
  const deleteMutation   = useDeleteSprint(projectId);

  const doneTasks  = sprint.tasks?.filter((t) => t.status === 'done').length ?? sprint.done_tasks ?? 0;
  const totalTasks = sprint.tasks?.length ?? sprint.total_tasks ?? 0;

  function handleDelete(e) {
    e.stopPropagation();
    if (!confirm(`Delete sprint "${sprint.name}"?`)) return;
    deleteMutation.mutate(sprint.id);
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md cursor-pointer',
        sprint.status === 'active'
          ? 'border-emerald-200 ring-1 ring-emerald-100'
          : 'border-gray-100'
      )}
      onClick={() => onNavigate(sprint.id)}
    >
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 truncate">{sprint.name}</h3>
            <SprintStatusBadge status={sprint.status} />
          </div>
          {sprint.goal && (
            <p className="text-sm text-gray-500 flex items-start gap-1.5 mt-1">
              <Target size={13} className="mt-0.5 shrink-0 text-indigo-400" />
              <span className="line-clamp-2">{sprint.goal}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        {canWrite && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {sprint.status === 'planning' && (
              <Button
                size="sm"
                variant="secondary"
                loading={startMutation.isPending}
                onClick={() => startMutation.mutate()}
                title="Start sprint"
              >
                <Play size={13} /> Start
              </Button>
            )}
            {sprint.status === 'active' && (
              <Button
                size="sm"
                variant="success"
                loading={completeMutation.isPending}
                onClick={() => completeMutation.mutate()}
                title="Complete sprint"
              >
                <CheckCheck size={13} /> Complete
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              title="Delete sprint"
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="px-5 pb-4 space-y-2.5">
        {(sprint.start_date || sprint.end_date) && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <CalendarDays size={12} />
            <span>
              {sprint.start_date ? formatDate(sprint.start_date) : '—'}
              {' → '}
              {sprint.end_date ? formatDate(sprint.end_date) : '—'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
          <ListChecks size={12} />
          <span>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</span>
        </div>

        <TaskProgress done={doneTasks} total={totalTasks} />
      </div>
    </div>
  );
}

// ── Create Sprint Modal ───────────────────────────────────────────────────────
function CreateSprintModal({ projectId, onClose }) {
  const createMutation = useCreateSprint(projectId);
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '' });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: null }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErrors({ name: 'Sprint name is required' });
      return;
    }
    const payload = { name: form.name.trim(), goal: form.goal.trim() || null };
    if (form.start_date) payload.start_date = form.start_date;
    if (form.end_date)   payload.end_date   = form.end_date;
    createMutation.mutate(payload, { onSuccess: onClose });
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">
          Sprint Name <span className="text-red-500">*</span>
        </label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="e.g. Sprint 1"
          className={cn(inputClass, errors.name && 'border-red-300 ring-1 ring-red-300')}
          autoFocus
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Goal</label>
        <textarea
          name="goal"
          value={form.goal}
          onChange={handleChange}
          placeholder="What should this sprint achieve?"
          rows={3}
          className={cn(inputClass, 'resize-none')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
          <input
            type="date"
            name="start_date"
            value={form.start_date}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
          <input
            type="date"
            name="end_date"
            value={form.end_date}
            onChange={handleChange}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Create Sprint
        </Button>
      </div>
    </form>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{children}</h2>
      {count !== undefined && (
        <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

// ── SprintsPage ───────────────────────────────────────────────────────────────
export function SprintsPage() {
  const { projectId } = useParams({ strict: false });
  const navigate      = useNavigate();
  const { data: project }                = useProject(projectId);
  const { data: sprints = [], isLoading } = useSprints(projectId);
  const { user }                         = useAuthStore();
  const [showCreate, setShowCreate]      = useState(false);

  const canWrite = hasMinRole(user?.role, 'member');

  const activeSprints    = sprints.filter((s) => s.status === 'active');
  const planningSprints  = sprints.filter((s) => s.status === 'planning');
  const completedSprints = sprints.filter((s) => s.status === 'completed');

  function handleNavigate(sprintId) {
    navigate({ to: `/app/projects/${projectId}/sprints/${sprintId}` });
  }

  const cardProps = { projectId, canWrite, onNavigate: handleNavigate };

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-6 max-w-5xl mx-auto">
          {/* Page toolbar */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-black text-gray-900">Sprints</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {sprints.length} sprint{sprints.length !== 1 ? 's' : ''} total
              </p>
            </div>
            {canWrite && (
              <Button onClick={() => setShowCreate(true)}>
                <Plus size={15} /> Create Sprint
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl border border-gray-100 animate-pulse" />
              ))}
            </div>
          ) : sprints.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🏃</div>
              <p className="font-bold text-gray-600 text-lg">No sprints yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {canWrite ? 'Click "Create Sprint" to get started.' : 'No sprints have been created for this project.'}
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Active sprint — prominent section */}
              {activeSprints.length > 0 && (
                <div>
                  <SectionHeading count={activeSprints.length}>Active</SectionHeading>
                  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {activeSprints.map((s) => (
                      <SprintCard key={s.id} sprint={s} {...cardProps} />
                    ))}
                  </div>
                </div>
              )}

              {/* Planning sprints */}
              {planningSprints.length > 0 && (
                <div>
                  <SectionHeading count={planningSprints.length}>Planning</SectionHeading>
                  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {planningSprints.map((s) => (
                      <SprintCard key={s.id} sprint={s} {...cardProps} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed sprints */}
              {completedSprints.length > 0 && (
                <div>
                  <SectionHeading count={completedSprints.length}>Completed</SectionHeading>
                  <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                    {completedSprints.map((s) => (
                      <SprintCard key={s.id} sprint={s} {...cardProps} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title="Create Sprint">
          <CreateSprintModal projectId={projectId} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
    </div>
  );
}
