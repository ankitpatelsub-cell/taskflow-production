import { useState, useEffect } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, CheckSquare, FolderKanban, MessageSquare, Filter, X } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils';
import api from '@/lib/api';
import { Input } from '@/components/ui/Input';

const PRIORITIES = ['urgent','high','medium','low'];
const STATUSES = ['todo','in_progress','review','done'];

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchPage() {
  const { q: initialQ = '' } = useSearch({ strict: false });
  const navigate = useNavigate();
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const [query, setQuery] = useState(initialQ);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');
  const dq = useDebouncedValue(query);

  useEffect(() => {
    navigate({ to: '/app/search', search: { q: query }, replace: true });
  }, [query]);

  const { data: results = {}, isLoading } = useQuery({
    queryKey: ['search-page', dq, status, priority, activeTab],
    queryFn: () => dq.length >= 2
      ? api.get('/search', { params: { q: dq, type: activeTab, status: status || undefined, priority: priority || undefined, limit: 30 } }).then((r) => r.data)
      : Promise.resolve({}),
    enabled: dq.length >= 2,
  });

  const tasks = results.tasks || [];
  const projects = results.projects || [];
  const comments = results.comments || [];

  const counts = {
    tasks: tasks.length,
    projects: projects.length,
    comments: comments.length,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Search</h2>

        {/* Search input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, comments…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters (only for tasks tab) */}
        {activeTab === 'tasks' && dq.length >= 2 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Filter size={13} className="text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-xl px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-xl px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            {(status || priority) && (
              <button onClick={() => { setStatus(''); setPriority(''); }} className="text-xs text-indigo-500 hover:underline">
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      {dq.length >= 2 && (
        <div className="flex gap-1 mb-4 border-b border-gray-100 dark:border-slate-700">
          {[['tasks', 'Tasks', CheckSquare], ['projects', 'Projects', FolderKanban], ['comments', 'Comments', MessageSquare]].map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              )}
            >
              <Icon size={13} />
              {label}
              {counts[id] > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeTab === id ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300' : 'bg-gray-100 dark:bg-slate-700 text-gray-500')}>
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {dq.length < 2 ? (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-3 opacity-20" />
          <p className="font-medium">Start typing to search</p>
          <p className="text-sm mt-1">Search across all projects, tasks, and comments</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {activeTab === 'tasks' && (
            tasks.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No tasks found</p>
            ) : tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveProject(t.project_id); openTaskDrawer(t.id); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all text-left"
              >
                <CheckSquare size={15} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{t.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t.project_name}
                    {t.assignee_name && ` · ${t.assignee_name}`}
                    {t.deadline && ` · due ${new Date(t.deadline).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium capitalize', STATUS_COLORS[t.status])}>
                    {STATUS_LABELS[t.status] || t.status}
                  </span>
                  <span className={cn('text-xs font-medium capitalize', {
                    urgent: 'text-red-500', high: 'text-orange-500', medium: 'text-amber-500', low: 'text-green-500'
                  }[t.priority])}>{t.priority}</span>
                </div>
              </button>
            ))
          )}

          {activeTab === 'projects' && (
            projects.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No projects found</p>
            ) : projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate({ to: `/app/projects/${p.id}/board` })}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: p.color || '#6366f1' }}>
                  <FolderKanban size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">{p.task_count} tasks</span>
              </button>
            ))
          )}

          {activeTab === 'comments' && (
            comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No comments found</p>
            ) : comments.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveProject(c.project_id); openTaskDrawer(c.task_id); }}
                className="w-full flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-sm transition-all text-left"
              >
                <MessageSquare size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-slate-200 line-clamp-2">{c.body}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.author_name} on <span className="text-indigo-500">{c.task_title}</span> · {c.project_name}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
