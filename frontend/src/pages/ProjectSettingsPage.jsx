import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ProjectNav } from './ProjectNav';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function ProjectSettingsPage() {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  // Tags
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tags`).then((r) => r.data),
    enabled: !!projectId,
  });
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#64748b');

  function handleUpdate() {
    update.mutate({
      name: name || project?.name,
      description: description || project?.description,
      color: color || project?.color,
    });
  }

  async function addTag() {
    if (!newTag.trim()) return;
    await api.post(`/projects/${projectId}/tags`, { name: newTag.trim(), color: newTagColor });
    setNewTag('');
  }

  async function deleteTag(id) {
    await api.delete(`/projects/${projectId}/tags/${id}`);
  }

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 max-w-xl mx-auto w-full space-y-8">
        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Project Settings</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input defaultValue={project?.name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                defaultValue={project?.description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              {archiveConfirm ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <span className="text-sm text-red-700 font-medium">Archive "{project?.name}"?</span>
                  <Button size="sm" variant="danger" onClick={() => {
                    update.mutate({ status: 'archived' }, {
                      onSuccess: () => { toast.success('Project archived'); navigate({ to: '/app/dashboard' }); }
                    });
                    setArchiveConfirm(false);
                  }}>
                    Yes, archive
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setArchiveConfirm(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="danger" onClick={() => setArchiveConfirm(true)}>Archive Project</Button>
              )}
              <Button onClick={handleUpdate} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 mb-4">Tags</h3>
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: t.color + '33', color: t.color }}>
                  {t.name}
                  <button onClick={() => deleteTag(t.id)} className="hover:opacity-60 ml-1">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="New tag name…"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-10 h-9 rounded border border-gray-300 cursor-pointer p-0.5" />
              <Button size="sm" onClick={addTag}>Add</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
