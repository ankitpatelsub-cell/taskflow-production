import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjects } from '@/hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Search, FolderKanban, CheckSquare, LayoutGrid, Users, BarChart2, MessageSquare, ArrowRight } from 'lucide-react';
import { cn, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const FILTERS = [
  { id: 'all',      label: 'All' },
  { id: 'tasks',    label: 'Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'comments', label: 'Comments' },
];

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dq = useDebouncedValue(query, 200);

  const { data: projects = [] } = useProjects();

  const { data: searchResults = {} } = useQuery({
    queryKey: ['global-search', dq, filter],
    queryFn: () => dq.length >= 2
      ? api.get('/search', { params: { q: dq, type: filter, limit: 10 } }).then((r) => r.data).catch(() => ({}))
      : Promise.resolve({}),
    enabled: dq.length >= 2,
  });

  // Build option list
  const options = [];
  const q = dq.toLowerCase();

  if (!dq || dq.length < 2) {
    // Default: navigation + recent projects
    const navItems = [
      { id: 'dash',    label: 'Go to Dashboard',    icon: LayoutGrid, action: () => navigate({ to: '/app/dashboard' }) },
      { id: 'profile', label: 'Go to Profile',       icon: Users,      action: () => navigate({ to: '/app/profile' }) },
      { id: 'notifs',  label: 'Go to Notifications', icon: BarChart2,  action: () => navigate({ to: '/app/notifications' }) },
    ];
    navItems.forEach((i) => options.push({ ...i, group: 'Navigation' }));

    projects.slice(0, 5).forEach((p) => options.push({
      id: `proj-${p.id}`, label: p.name,
      sublabel: `${p.task_count || 0} tasks`, icon: FolderKanban, color: p.color,
      group: 'Recent Projects',
      action: () => navigate({ to: `/app/projects/${p.id}/board` }),
    }));
  } else {
    // Tasks
    const tasks = searchResults.tasks || [];
    tasks.forEach((t) => options.push({
      id: `task-${t.id}`, label: t.title, sublabel: t.project_name,
      icon: CheckSquare, group: 'Tasks', status: t.status,
      action: () => { setActiveProject(t.project_id); openTaskDrawer(t.id); },
    }));

    // Projects
    const projs = searchResults.projects || [];
    projs.forEach((p) => options.push({
      id: `proj-${p.id}`, label: p.name,
      sublabel: `${p.task_count || 0} tasks`, icon: FolderKanban, color: p.color,
      group: 'Projects',
      action: () => navigate({ to: `/app/projects/${p.id}/board` }),
    }));

    // Comments
    const comments = searchResults.comments || [];
    comments.forEach((c) => options.push({
      id: `cmt-${c.id}`, label: c.body.slice(0, 80),
      sublabel: `${c.author_name} on ${c.task_title}`,
      icon: MessageSquare, group: 'Comments',
      action: () => { setActiveProject(c.project_id); openTaskDrawer(c.task_id); },
    }));

    // "Full results" link
    if (tasks.length > 0 || projs.length > 0 || comments.length > 0) {
      options.push({
        id: 'full-results', label: `See all results for "${q}"`,
        icon: ArrowRight, group: '',
        action: () => navigate({ to: '/app/search', search: { q } }),
      });
    }
  }

  useEffect(() => setCursor(0), [options.length, dq, filter]);

  useEffect(() => {
    if (open) {
      setQuery(''); setFilter('all'); setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((opt) => { opt.action(); onClose(); }, [onClose]);

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, options.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && options[cursor]) execute(options[cursor]);
    if (e.key === 'Escape') onClose();
  }

  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const groups = [];
  let lastGroup = null;
  options.forEach((opt, idx) => {
    if (opt.group !== lastGroup) { groups.push({ type: 'header', label: opt.group }); lastGroup = opt.group; }
    groups.push({ type: 'item', opt, idx });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-gray-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Search size={17} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search tasks, projects, comments…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 font-mono">esc</kbd>
        </div>

        {/* Filter tabs (only when query exists) */}
        {dq.length >= 2 && (
          <div className="flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-slate-700">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-xl text-xs font-medium transition-colors',
                  filter === f.id
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              {dq.length >= 2 ? 'No results found' : 'Start typing to search…'}
            </p>
          )}
          {groups.map((g, gi) =>
            g.type === 'header' ? (
              g.label ? (
                <p key={`h${gi}`} className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {g.label}
                </p>
              ) : <div key={`h${gi}`} className="mt-1 border-t border-gray-100 dark:border-slate-700" />
            ) : (
              <button
                key={g.opt.id}
                onClick={() => execute(g.opt)}
                onMouseEnter={() => setCursor(g.idx)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                  cursor === g.idx
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                )}
              >
                {g.opt.color
                  ? <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: g.opt.color }}>
                      <g.opt.icon size={12} className="text-white" />
                    </span>
                  : <g.opt.icon size={15} className="shrink-0 text-gray-400" />
                }
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{g.opt.label}</span>
                  {g.opt.sublabel && (
                    <span className="block text-xs text-gray-400 dark:text-slate-500 truncate">{g.opt.sublabel}</span>
                  )}
                </span>
                {g.opt.status && (
                  <span className={cn('shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium', STATUS_COLORS[g.opt.status])}>
                    {STATUS_LABELS[g.opt.status]}
                  </span>
                )}
                {cursor === g.idx && <kbd className="shrink-0 text-xs text-indigo-400 font-mono ml-1">↵</kbd>}
              </button>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
