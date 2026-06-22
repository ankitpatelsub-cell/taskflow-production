import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, Trash2, CheckCircle2, Circle, CalendarDays, ChevronDown, ChevronRight, Edit2, X, Check } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProjectNav } from './ProjectNav';
import { toast } from '@/components/ui/Toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  active:    { bg: 'bg-indigo-100 dark:bg-indigo-900/40',   text: 'text-indigo-700 dark:text-indigo-300' },
  completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' },
  paused:    { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-300' },
  archived:  { bg: 'bg-gray-100 dark:bg-slate-700',         text: 'text-gray-500 dark:text-slate-400' },
};

const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#06b6d4'];

function useObjectives(projectId) {
  return useQuery({
    queryKey: ['okrs', projectId],
    queryFn: () => api.get(`/projects/${projectId}/okrs`).then((r) => r.data),
    enabled: !!projectId,
  });
}

function useKeyResults(objectiveId, projectId, enabled) {
  return useQuery({
    queryKey: ['okrs-krs', objectiveId],
    queryFn: () => api.get(`/projects/${projectId}/okrs/${objectiveId}/key-results`).then((r) => r.data),
    enabled: !!objectiveId && !!enabled,
  });
}

// ── Create Objective Modal ────────────────────────────────────────────────────
function CreateObjectiveModal({ projectId, onClose }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#6366f1');

  const create = useMutation({
    mutationFn: (body) => api.post(`/projects/${projectId}/okrs`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs', projectId] });
      toast.success('Objective created');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create objective'),
  });

  return (
    <Modal open onClose={onClose} title="New Objective">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate({ title, description, start_date: startDate || undefined, end_date: endDate || undefined, color }); }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Improve customer retention" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What does success look like?"
            className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Start date</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">End date</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn('w-7 h-7 rounded-full border-2 transition-transform', color === c ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create objective'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Key Result Row ────────────────────────────────────────────────────────────
function KeyResultRow({ kr, projectId, objectiveId }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [currentVal, setCurrentVal] = useState(String(kr.current_value));

  const updateKR = useMutation({
    mutationFn: (body) => api.patch(`/projects/${projectId}/okrs/${objectiveId}/key-results/${kr.id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs-krs', objectiveId] });
      qc.invalidateQueries({ queryKey: ['okrs', projectId] });
      setEditing(false);
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteKR = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/okrs/${objectiveId}/key-results/${kr.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs-krs', objectiveId] });
      qc.invalidateQueries({ queryKey: ['okrs', projectId] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const progress = kr.target_value > 0 ? Math.min(100, Math.round((Number(kr.current_value) / Number(kr.target_value)) * 100)) : 0;
  const isComplete = progress >= 100;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
      <div className={cn('w-4 h-4 rounded-full shrink-0', isComplete ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 dark:text-white truncate">{kr.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-24 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', isComplete ? 'bg-emerald-500' : 'bg-indigo-500')}
              style={{ width: `${progress}%` }}
            />
          </div>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={currentVal}
                onChange={(e) => setCurrentVal(e.target.value)}
                className="w-16 text-xs border border-indigo-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-500"
                min="0"
                max={kr.target_value}
                autoFocus
              />
              <span className="text-xs text-gray-400">/ {kr.target_value} {kr.unit}</span>
              <button onClick={() => updateKR.mutate({ current_value: Number(currentVal) })} className="text-emerald-500 hover:text-emerald-600"><Check size={13} /></button>
              <button onClick={() => { setEditing(false); setCurrentVal(String(kr.current_value)); }} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
              {kr.current_value} / {kr.target_value} {kr.unit} · {progress}%
            </button>
          )}
        </div>
      </div>
      <button
        onClick={() => { if (!confirm(`Delete "${kr.title}"?`)) return; deleteKR.mutate(); }}
        className="text-gray-200 hover:text-red-500 transition-colors p-1 rounded shrink-0"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ── Add Key Result Form ───────────────────────────────────────────────────────
function AddKeyResultForm({ projectId, objectiveId, onDone }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('100');
  const [unit, setUnit] = useState('%');

  const create = useMutation({
    mutationFn: (body) => api.post(`/projects/${projectId}/okrs/${objectiveId}/key-results`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['okrs-krs', objectiveId] });
      qc.invalidateQueries({ queryKey: ['okrs', projectId] });
      onDone();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to add key result'),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ title, target_value: Number(target), unit });
      }}
      className="flex items-center gap-2 pt-2"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Key result title…"
        required
        autoFocus
        className="flex-1 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white dark:border-slate-500"
      />
      <input
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        min="1"
        className="w-16 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white text-center"
        title="Target value"
      />
      <input
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        className="w-12 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white text-center"
        placeholder="%"
        title="Unit"
      />
      <button type="submit" disabled={create.isPending} className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors"><Check size={15} /></button>
      <button type="button" onClick={onDone} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"><X size={15} /></button>
    </form>
  );
}

// ── Objective Card ─────────────────────────────────────────────────────────────
function ObjectiveCard({ objective, projectId }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [addingKR, setAddingKR] = useState(false);

  const { data: krs = [] } = useKeyResults(objective.id, projectId, expanded || addingKR);

  const update = useMutation({
    mutationFn: (body) => api.patch(`/projects/${projectId}/okrs/${objective.id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['okrs', projectId] }),
    onError: () => toast.error('Failed to update'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/okrs/${objective.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['okrs', projectId] }); toast.success('Objective deleted'); },
    onError: () => toast.error('Failed to delete objective'),
  });

  const progress = Number(objective.progress) || 0;
  const isCompleted = objective.status === 'completed';
  const isOverdue = objective.end_date && !isCompleted && new Date(objective.end_date) < new Date();
  const statusC = STATUS_COLORS[objective.status] || STATUS_COLORS.active;
  const krCount = Number(objective.kr_count) || 0;

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-2xl border shadow-sm transition-all',
      isCompleted ? 'border-emerald-200 dark:border-emerald-900 opacity-80' : 'border-gray-100 dark:border-slate-700'
    )}>
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Color dot + toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 shrink-0 flex items-center gap-1 text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: objective.color }} />
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={cn('font-semibold text-gray-900 dark:text-white', isCompleted && 'line-through text-gray-400')}>
                {objective.title}
              </h3>
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', statusC.bg, statusC.text)}>
                {objective.status}
              </span>
            </div>

            {objective.description && (
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{objective.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {(objective.start_date || objective.end_date) && (
                <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500' : 'text-gray-400')}>
                  <CalendarDays size={12} />
                  {objective.start_date && new Date(objective.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  {objective.start_date && objective.end_date && ' → '}
                  {objective.end_date && new Date(objective.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {isOverdue && ' · Overdue'}
                </span>
              )}
              <span className="text-xs text-gray-400">{krCount} key result{krCount !== 1 ? 's' : ''}</span>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{progress}% complete</span>
                {/* Quick status toggle */}
                <button
                  onClick={() => update.mutate({ status: isCompleted ? 'active' : 'completed' })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                >
                  {isCompleted
                    ? <><CheckCircle2 size={12} className="text-emerald-500" /> Mark active</>
                    : <><Circle size={12} /> Mark complete</>
                  }
                </button>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-emerald-500' : progress >= 70 ? 'bg-indigo-500' : progress >= 40 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => { if (!confirm(`Delete "${objective.title}"?`)) return; del.mutate(); }}
            className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded key results */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-50 dark:border-slate-700 pt-3">
          {krs.length === 0 && !addingKR ? (
            <p className="text-sm text-gray-400 py-2">No key results yet.</p>
          ) : (
            <div>
              {krs.map((kr) => (
                <KeyResultRow key={kr.id} kr={kr} projectId={projectId} objectiveId={objective.id} />
              ))}
            </div>
          )}
          {addingKR ? (
            <AddKeyResultForm projectId={projectId} objectiveId={objective.id} onDone={() => setAddingKR(false)} />
          ) : (
            <button
              onClick={() => setAddingKR(true)}
              className="mt-2 flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-medium"
            >
              <Plus size={13} /> Add key result
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function OKRsPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: objectives = [], isLoading } = useObjectives(projectId);
  const [showCreate, setShowCreate] = useState(false);

  const active = objectives.filter((o) => o.status !== 'completed' && o.status !== 'archived');
  const completed = objectives.filter((o) => o.status === 'completed');
  const archived = objectives.filter((o) => o.status === 'archived');

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">OKRs</h2>
              <span className="text-sm text-gray-400">({active.length} active)</span>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> New objective
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-32 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}</div>
          ) : objectives.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Target size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No objectives yet</p>
              <p className="text-sm mt-1">Create OKRs to track strategic goals and key results</p>
            </div>
          ) : (
            <div className="space-y-6">
              {active.length > 0 && (
                <div className="space-y-3">
                  {active.map((o) => <ObjectiveCard key={o.id} objective={o} projectId={projectId} />)}
                </div>
              )}
              {completed.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors list-none flex items-center gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {completed.length} completed objective{completed.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-3">
                    {completed.map((o) => <ObjectiveCard key={o.id} objective={o} projectId={projectId} />)}
                  </div>
                </details>
              )}
              {archived.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors list-none flex items-center gap-2 mb-3">
                    {archived.length} archived
                  </summary>
                  <div className="space-y-3">
                    {archived.map((o) => <ObjectiveCard key={o.id} objective={o} projectId={projectId} />)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
      {showCreate && <CreateObjectiveModal projectId={projectId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
