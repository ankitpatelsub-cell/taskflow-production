import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Plus, Trash2, CheckCircle2, Circle, CalendarDays, ListChecks } from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ProjectNav } from './ProjectNav';
import { toast } from '@/components/ui/Toast';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

function useMilestones(projectId) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: () => api.get(`/projects/${projectId}/milestones`).then((r) => r.data),
    enabled: !!projectId,
  });
}

function CreateMilestoneModal({ projectId, onClose }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const create = useMutation({
    mutationFn: (body) => api.post(`/projects/${projectId}/milestones`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] });
      toast.success('Milestone created');
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create milestone'),
  });

  return (
    <Modal open onClose={onClose} title="New Milestone">
      <form
        onSubmit={(e) => { e.preventDefault(); create.mutate({ title, description, due_date: dueDate || undefined }); }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. v1.0 Launch" required autoFocus />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What needs to be done for this milestone?"
            className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Due date</label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create milestone'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MilestoneCard({ milestone, projectId }) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () => api.patch(`/projects/${projectId}/milestones/${milestone.id}`, {
      status: milestone.status === 'completed' ? 'open' : 'completed',
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones', projectId] }),
    onError: () => toast.error('Failed to update milestone'),
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/milestones/${milestone.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['milestones', projectId] }); toast.success('Milestone deleted'); },
    onError: () => toast.error('Failed to delete milestone'),
  });

  const taskCount = Number(milestone.task_count) || 0;
  const doneCount = Number(milestone.done_count) || 0;
  const progress = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
  const isCompleted = milestone.status === 'completed';
  const isOverdue = milestone.due_date && !isCompleted && new Date(milestone.due_date) < new Date();

  return (
    <div className={cn(
      'bg-white dark:bg-slate-800 rounded-2xl border p-5 shadow-sm transition-all',
      isCompleted ? 'border-emerald-200 dark:border-emerald-900 opacity-75' : 'border-gray-100 dark:border-slate-700'
    )}>
      <div className="flex items-start gap-3">
        <button onClick={() => toggle.mutate()} className="mt-0.5 shrink-0" title="Toggle completion">
          {isCompleted
            ? <CheckCircle2 size={20} className="text-emerald-500" />
            : <Circle size={20} className="text-gray-300 hover:text-indigo-400 transition-colors" />}
        </button>
        <div className="flex-1 min-w-0">
          <h3 className={cn('font-semibold text-gray-900 dark:text-white', isCompleted && 'line-through text-gray-400')}>
            {milestone.title}
          </h3>
          {milestone.description && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{milestone.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {milestone.due_date && (
              <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500' : 'text-gray-400')}>
                <CalendarDays size={12} />
                {new Date(milestone.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {isOverdue && ' · Overdue'}
              </span>
            )}
            {taskCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <ListChecks size={12} />
                {doneCount}/{taskCount} tasks
              </span>
            )}
          </div>
          {taskCount > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{progress}% complete</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isCompleted ? 'bg-emerald-500' : 'bg-indigo-500')}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (!confirm(`Delete "${milestone.title}"?`)) return;
            del.mutate();
          }}
          className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded shrink-0"
          title="Delete milestone"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export function MilestonesPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: milestones = [], isLoading } = useMilestones(projectId);
  const [showCreate, setShowCreate] = useState(false);

  const open = milestones.filter((m) => m.status === 'open');
  const completed = milestones.filter((m) => m.status === 'completed');

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Flag size={18} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Milestones</h2>
              <span className="text-sm text-gray-400">({open.length} open)</span>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> New milestone
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />)}</div>
          ) : milestones.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Flag size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-medium">No milestones yet</p>
              <p className="text-sm mt-1">Create milestones to track major project goals</p>
            </div>
          ) : (
            <div className="space-y-6">
              {open.length > 0 && (
                <div className="space-y-3">
                  {open.map((m) => <MilestoneCard key={m.id} milestone={m} projectId={projectId} />)}
                </div>
              )}
              {completed.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors list-none flex items-center gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    {completed.length} completed milestone{completed.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-3">
                    {completed.map((m) => <MilestoneCard key={m.id} milestone={m} projectId={projectId} />)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
      {showCreate && <CreateMilestoneModal projectId={projectId} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
