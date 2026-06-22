import { useState } from 'react';
import {
  useProjectStatuses,
  useCreateStatus,
  useUpdateStatus,
  useDeleteStatus,
  useReorderStatuses,
} from '@/hooks/useProjectStatuses';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { Lock, Trash2, ChevronUp, ChevronDown, Plus, Check, Star } from 'lucide-react';

const COLOR_SWATCHES = [
  '#6b7280', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

const DEFAULT_KEYS = ['todo', 'in_progress', 'review', 'done'];

export function WorkflowSettings({ projectId }) {
  const { data: statuses = [], isLoading } = useProjectStatuses(projectId);
  const createStatus = useCreateStatus(projectId);
  const updateStatus = useUpdateStatus(projectId);
  const deleteStatus = useDeleteStatus(projectId);
  const reorderStatuses = useReorderStatuses(projectId);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);

  // Inline edit state: { id, name }
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  function startEdit(status) {
    setEditingId(status.id);
    setEditingName(status.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit(status) {
    if (!editingName.trim() || editingName.trim() === status.name) {
      cancelEdit();
      return;
    }
    try {
      await updateStatus.mutateAsync({ id: status.id, data: { name: editingName.trim() } });
      toast.success('Status renamed');
    } catch {
      toast.error('Failed to rename status');
    }
    cancelEdit();
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    try {
      await createStatus.mutateAsync({ name: newName.trim(), color: newColor });
      toast.success('Status created');
      setNewName('');
      setNewColor(COLOR_SWATCHES[0]);
      setShowAddForm(false);
    } catch {
      toast.error('Failed to create status');
    }
  }

  async function handleDelete(status) {
    if (statuses.length <= 1) {
      toast.error('Cannot delete the last status');
      return;
    }
    const taskCount = status.task_count ?? 0;
    const warning = taskCount > 0
      ? `This status has ${taskCount} task${taskCount !== 1 ? 's' : ''}. Tasks will be moved to the first available status. Delete anyway?`
      : `Delete "${status.name}"?`;
    if (!confirm(warning)) return;
    try {
      await deleteStatus.mutateAsync(status.id);
      toast.success('Status deleted');
    } catch {
      toast.error('Failed to delete status');
    }
  }

  async function handleMove(index, direction) {
    const next = [...statuses];
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    try {
      await reorderStatuses.mutateAsync(next.map(s => s.id));
    } catch {
      toast.error('Failed to reorder statuses');
    }
  }

  async function handleSetDefault(status) {
    try {
      await updateStatus.mutateAsync({ id: status.id, data: { is_default: true } });
      toast.success(`"${status.name}" set as default`);
    } catch {
      toast.error('Failed to update default status');
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
      {/* Status list */}
      {statuses.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 italic">No statuses defined. Add one below.</p>
      ) : (
        <div className="space-y-1.5">
          {statuses.map((status, index) => {
            const isDefault = DEFAULT_KEYS.includes(status.key);
            const isProjectDefault = status.is_default;
            const isEditing = editingId === status.id;

            return (
              <div
                key={status.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 group"
              >
                {/* Colored dot */}
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: status.color || '#6b7280' }}
                />

                {/* Name (inline edit) */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => saveEdit(status)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(status);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-full text-sm border border-indigo-300 rounded-lg px-2 py-0.5 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <button
                      className="text-sm font-medium text-gray-800 dark:text-slate-200 hover:text-indigo-600 transition-colors text-left truncate w-full"
                      onClick={() => !isDefault && startEdit(status)}
                      title={isDefault ? 'Built-in status (rename via edit icon)' : 'Click to rename'}
                    >
                      {status.name}
                    </button>
                  )}
                </div>

                {/* Key badge */}
                <span className="text-xs font-mono bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded shrink-0">
                  {status.key}
                </span>

                {/* Default badge */}
                {isProjectDefault && (
                  <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-semibold shrink-0">
                    default
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Set as default */}
                  {!isProjectDefault && (
                    <button
                      onClick={() => handleSetDefault(status)}
                      title="Set as default for new tasks"
                      className="p-1 text-gray-300 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Star size={13} />
                    </button>
                  )}

                  {/* Up */}
                  <button
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-gray-300 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>

                  {/* Down */}
                  <button
                    onClick={() => handleMove(index, 1)}
                    disabled={index === statuses.length - 1}
                    className="p-1 text-gray-300 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* Lock or delete */}
                  {isDefault ? (
                    <span title="Built-in status — cannot be deleted" className="p-1 text-gray-200 dark:text-slate-600">
                      <Lock size={13} />
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(status)}
                      disabled={statuses.length <= 1 || deleteStatus.isPending}
                      title={statuses.length <= 1 ? 'Cannot delete the last status' : 'Delete status'}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="border border-dashed border-indigo-200 dark:border-indigo-700 rounded-xl p-4 space-y-3 bg-indigo-50/30 dark:bg-indigo-900/10">
          <div className="flex gap-2 items-center">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') { setShowAddForm(false); setNewName(''); }
              }}
              placeholder="Status name"
              className="flex-1"
            />
          </div>

          {/* Color swatches */}
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1.5">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="w-7 h-7 rounded-full transition-all flex items-center justify-center"
                  style={{ backgroundColor: c, outline: newColor === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                  title={c}
                >
                  {newColor === c && <Check size={12} color="white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || createStatus.isPending}>
              {createStatus.isPending ? 'Adding…' : 'Add Status'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setShowAddForm(false); setNewName(''); setNewColor(COLOR_SWATCHES[0]); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-medium transition-colors"
        >
          <Plus size={14} /> Add status
        </button>
      )}
    </div>
  );
}
