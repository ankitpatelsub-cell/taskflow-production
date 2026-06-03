import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Link2, Code2, GitPullRequest, GitCommitHorizontal, CircleDot, Trash2, Plus, ExternalLink } from 'lucide-react';

const TYPE_ICON = {
  github_pr:     GitPullRequest,
  github_commit: GitCommitHorizontal,
  github_issue:  CircleDot,
  github:        Code2,
  url:           Link2,
};

const TYPE_COLOR = {
  github_pr:     'text-purple-500',
  github_commit: 'text-gray-500',
  github_issue:  'text-green-500',
  github:        'text-gray-700',
  url:           'text-blue-500',
};

export function TaskLinks({ taskId }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const { data: links = [] } = useQuery({
    queryKey: ['task-links', taskId],
    queryFn: () => api.get(`/tasks/${taskId}/links`).then(r => r.data),
    enabled: !!taskId,
  });

  const add = useMutation({
    mutationFn: (body) => api.post(`/tasks/${taskId}/links`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-links', taskId] });
      setUrl(''); setTitle(''); setAdding(false);
    },
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/tasks/${taskId}/links/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-links', taskId] }),
  });

  function handleAdd(e) {
    e.preventDefault();
    if (!url.trim()) return;
    add.mutate({ url: url.trim(), title: title.trim() || undefined });
  }

  return (
    <div className="space-y-2">
      {links.map(link => {
        const Icon = TYPE_ICON[link.link_type] || Link2;
        const color = TYPE_COLOR[link.link_type] || 'text-gray-400';
        return (
          <div
            key={link.id}
            className="group flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600 hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <Icon size={15} className={`shrink-0 ${color}`} />
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm text-gray-800 dark:text-slate-200 hover:text-indigo-600 truncate font-medium"
            >
              {link.title}
            </a>
            <ExternalLink size={11} className="shrink-0 text-gray-300 group-hover:text-indigo-400" />
            <button
              onClick={() => remove.mutate(link.id)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              title="Remove link"
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <input
            autoFocus
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://github.com/org/repo/pull/123"
            className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
          />
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" loading={add.isPending}>Add link</Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
          {add.isError && (
            <p className="text-xs text-red-500">{add.error?.response?.data?.error || 'Invalid URL'}</p>
          )}
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1"
        >
          <Plus size={14} /> Add link
        </button>
      )}

      {links.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-2">No links yet. Add GitHub PRs, issues, or any URL.</p>
      )}
    </div>
  );
}
