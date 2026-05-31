import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useProjects } from '@/hooks/useProjects';
import { useCreateTask } from '@/hooks/useTasks';
import { useUiStore } from '@/stores/uiStore';

export function QuickCreateButton() {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [errors, setErrors] = useState({});
  const { data: projects = [] } = useProjects();
  const activeProjects = projects.filter((p) => p.status === 'active');
  const { setActiveProject, quickCreateOpen: open, openQuickCreate, closeQuickCreate } = useUiStore();
  const setOpen = (v) => v ? openQuickCreate() : closeQuickCreate();

  const create = useCreateTask(projectId);

  function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!projectId) errs.projectId = 'Please select a project';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    create.mutate({ title: title.trim(), priority }, {
      onSuccess: () => {
        setTitle('');
        setOpen(false);
        setActiveProject(projectId);
      },
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-300 dark:shadow-indigo-900/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Quick create task (Q)"
      >
        <Plus size={22} />
      </button>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Quick Create Task">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Task title *</label>
              <Input
                autoFocus
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((p) => ({ ...p, title: '' })); }}
                placeholder="What needs to be done?"
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Project *</label>
                <Select value={projectId} onChange={(e) => { setProjectId(e.target.value); if (errors.projectId) setErrors((p) => ({ ...p, projectId: '' })); }}>
                  <option value="">Select project…</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                {errors.projectId && <p className="text-xs text-red-500 mt-1">{errors.projectId}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Priority</label>
                <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
