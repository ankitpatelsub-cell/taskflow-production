import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Filter, X, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export function KanbanFilters({ projectId, filters, onChange }) {
  const [open, setOpen] = useState(false);
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data.members ?? []),
    enabled: !!projectId,
  });
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tags`).then((r) => Array.isArray(r.data) ? r.data : []),
    enabled: !!projectId,
  });

  const activeCount = Object.values(filters).filter(Boolean).length;

  function clear() { onChange({ assignee: '', priority: '', tag: '', q: '' }); }

  async function handleExport() {
    try {
      const res = await api.get(`/projects/${projectId}/tasks/export.csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tasks-${projectId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded');
    } catch {
      toast.error('Export failed');
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Search */}
        <input
          value={filters.q || ''}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Search tasks…"
          className="text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3.5 py-1.5 w-48 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
            activeCount > 0
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600 hover:border-indigo-300'
          )}
        >
          <Filter size={14} />
          Filters
          {activeCount > 0 && (
            <span className="bg-white/30 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button onClick={clear} className="text-gray-400 hover:text-red-500 transition-colors" title="Clear filters">
            <X size={16} />
          </button>
        )}

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:border-indigo-300 transition-colors"
          title="Export to CSV"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Filter panel */}
      {open && (
        <div className="absolute top-10 right-0 z-20 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl p-4 w-72 space-y-4">
          {/* Assignee */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assignee</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onChange({ ...filters, assignee: '' })}
                className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  !filters.assignee ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-300'
                )}
              >All</button>
              {(members ?? []).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ ...filters, assignee: filters.assignee === m.id ? '' : m.id })}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    filters.assignee === m.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-indigo-300'
                  )}
                >
                  {m.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Priority</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onChange({ ...filters, priority: '' })}
                className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                  !filters.priority ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                )}
              >All</button>
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => onChange({ ...filters, priority: filters.priority === p ? '' : p })}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-colors',
                    filters.priority === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                  )}
                >{p}</button>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tag</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onChange({ ...filters, tag: '' })}
                  className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                    !filters.tag ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                  )}
                >All</button>
                {(tags ?? []).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onChange({ ...filters, tag: filters.tag === t.id ? '' : t.id })}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                      filters.tag === t.id ? 'text-white' : 'text-gray-700 dark:text-slate-300'
                    )}
                    style={filters.tag === t.id
                      ? { backgroundColor: t.color, borderColor: t.color }
                      : { borderColor: t.color + '60', color: t.color }
                    }
                  >{t.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1 border-t border-gray-100 dark:border-slate-700">
            <button onClick={() => setOpen(false)} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
