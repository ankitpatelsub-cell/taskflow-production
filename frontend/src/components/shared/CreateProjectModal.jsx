import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateProject } from '@/hooks/useProjects';

const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316',
  '#f59e0b','#10b981','#06b6d4','#3b82f6','#64748b',
];

export function CreateProjectModal({ onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [nameError, setNameError] = useState('');
  const create = useCreateProject();

  const handle = () => {
    if (!name.trim()) { setNameError('Project name is required'); return; }
    setNameError('');
    create.mutate({ name: name.trim(), description, color }, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title="Create Project">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
            placeholder="Project name"
            className={nameError ? 'border-red-400 focus:ring-red-400' : ''}
          />
          {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Color</label>
          <div className="flex items-center gap-3">
            <div className="flex flex-wrap gap-2 flex-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-200 dark:border-slate-600"
                title="Custom color"
              />
              <span className="text-xs text-gray-400 font-mono">{color}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handle} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
