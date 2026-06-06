import { useState, useEffect } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ProjectNav } from './ProjectNav';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { WebhooksSettings } from '@/components/settings/WebhooksSettings';
import { SlackSettings } from '@/components/settings/SlackSettings';
import { useMutation } from '@tanstack/react-query';

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
  '#14b8a6', '#84cc16',
];

export function ProjectSettingsPage() {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const update = useUpdateProject(projectId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form from loaded project
  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setColor(project.color || COLORS[0]);
    }
  }, [project?.id]);

  // Tags
  const { data: tags = [], refetch: refetchTags } = useQuery({
    queryKey: ['tags', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tags`).then((r) => r.data),
    enabled: !!projectId,
  });
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState('#64748b');

  function handleUpdate() {
    update.mutate({ name, description, color }, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        toast.success('Project settings saved');
      },
    });
  }

  async function addTag() {
    if (!newTag.trim()) return;
    await api.post(`/projects/${projectId}/tags`, { name: newTag.trim(), color: newTagColor });
    setNewTag('');
    refetchTags();
    qc.invalidateQueries({ queryKey: ['tags', projectId] });
  }

  async function deleteTag(id) {
    await api.delete(`/projects/${projectId}/tags/${id}`);
    refetchTags();
    qc.invalidateQueries({ queryKey: ['tags', projectId] });
  }

  // Custom fields
  const { data: customFields = [], refetch: refetchFields } = useQuery({
    queryKey: ['custom-fields', projectId],
    queryFn: () => api.get(`/projects/${projectId}/custom-fields`).then((r) => r.data),
    enabled: !!projectId,
  });
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const addField = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/custom-fields`, { name: newFieldName.trim(), type: newFieldType }),
    onSuccess: () => { setNewFieldName(''); refetchFields(); toast.success('Field added'); },
    onError: () => toast.error('Failed to add field'),
  });
  const deleteField = useMutation({
    mutationFn: (id) => api.delete(`/projects/${projectId}/custom-fields/${id}`),
    onSuccess: () => { refetchFields(); toast.success('Field removed'); },
  });

  // Public share
  const enableShare = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/share`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); toast.success('Public link enabled'); },
  });
  const disableShare = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}/share`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); toast.success('Public link disabled'); },
  });
  const shareUrl = project?.share_enabled && project?.share_token
    ? `${window.location.origin}/share/${project.share_token}`
    : null;

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="p-6 max-w-xl mx-auto w-full space-y-6 overflow-auto">
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Project Settings</h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Brief project description…"
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Project Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400 dark:ring-slate-500' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="mt-3 flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg w-fit">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-500 dark:text-slate-400">Preview</span>
                <span className="text-xs font-semibold text-gray-700 dark:text-slate-200">{name || 'Project'}</span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-700">
              <div>
                {archiveConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">Archive project?</span>
                    <Button size="sm" variant="danger" onClick={() => {
                      update.mutate({ status: 'archived' }, {
                        onSuccess: () => { toast.success('Project archived'); navigate({ to: '/app/dashboard' }); }
                      });
                      setArchiveConfirm(false);
                    }}>
                      Archive
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setArchiveConfirm(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => setArchiveConfirm(true)}>Archive Project</Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Saved!</span>}
                <Button onClick={handleUpdate} disabled={update.isPending || !name.trim()}>
                  {update.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Tags</h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 italic">No tags yet. Add one below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium"
                    style={{ backgroundColor: t.color + '22', color: t.color, border: `1px solid ${t.color}44` }}
                  >
                    {t.name}
                    <button
                      onClick={() => deleteTag(t.id)}
                      className="hover:opacity-70 ml-0.5 leading-none text-base"
                      title="Remove tag"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
              <input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Tag name (Enter to add)"
                className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="w-10 h-9 rounded-lg border border-gray-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-700"
                title="Tag color"
              />
              <Button size="sm" onClick={addTag} disabled={!newTag.trim()}>Add</Button>
            </div>
          </div>
        </div>

        {/* Custom Fields */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Custom Fields</h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
            {customFields.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 italic">No custom fields yet.</p>
            ) : (
              <div className="space-y-2">
                {customFields.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{f.name}</span>
                      <span className="ml-2 text-xs text-gray-400 bg-gray-100 dark:bg-slate-600 px-1.5 py-0.5 rounded">{f.type}</span>
                    </div>
                    <button onClick={() => deleteField.mutate(f.id)} className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
              <input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && newFieldName.trim() && addField.mutate()}
                placeholder="Field name (Enter to add)"
                className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white"
              />
              <select
                value={newFieldType}
                onChange={(e) => setNewFieldType(e.target.value)}
                className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white"
              >
                {['text','number','select','date','checkbox','url'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" onClick={() => addField.mutate()} disabled={!newFieldName.trim() || addField.isPending}>Add</Button>
            </div>
          </div>
        </div>

        {/* Public Share */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Public Share Link</h3>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-sm text-gray-500 dark:text-slate-400">Share a read-only view of this project with anyone, even without a Tick account.</p>
            {shareUrl ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} className="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-gray-50 dark:bg-slate-700 dark:text-white font-mono text-xs" />
                  <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success('Copied!'); }}>Copy</Button>
                </div>
                <Button size="sm" variant="danger" onClick={() => disableShare.mutate()} disabled={disableShare.isPending}>Disable Link</Button>
              </div>
            ) : (
              <Button onClick={() => enableShare.mutate()} disabled={enableShare.isPending}>Enable Public Link</Button>
            )}
          </div>
        </div>

        {/* Webhooks */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Webhooks</h3>
          <WebhooksSettings projectId={projectId} />
        </div>

        {/* Slack */}
        <div>
          <h3 className="font-bold text-gray-800 dark:text-white mb-4">Slack Integration</h3>
          <SlackSettings projectId={projectId} />
        </div>
      </div>
    </div>
  );
}
