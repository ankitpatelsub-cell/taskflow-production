import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjects } from '@/hooks/useProjects';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Search, FolderKanban, CheckSquare, LayoutGrid, Users, Settings, BarChart2 } from 'lucide-react';
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

export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const { openTaskDrawer, setActiveProject } = useUiStore();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const dq = useDebouncedValue(query, 150);

  const { data: projects = [] } = useProjects();

  const { data: tasks = [] } = useQuery({
    queryKey: ['cmd-tasks', dq],
    queryFn: () => dq.length >= 2
      ? api.get('/projects/all/tasks', { params: { q: dq, limit: 8 } })
           .then(r => r.data)
           .catch(() => [])
      : Promise.resolve([]),
    enabled: dq.length >= 2,
  });

  // Build option list
  const options = [];

  const q = dq.toLowerCase();

  // Static nav items
  const navItems = [
    { id: 'dash',    label: 'Go to Dashboard',       icon: LayoutGrid, action: () => navigate({ to: '/app/dashboard' }) },
    { id: 'profile', label: 'Go to Profile',          icon: Users,      action: () => navigate({ to: '/app/profile' }) },
    { id: 'notifs',  label: 'Go to Notifications',    icon: BarChart2,  action: () => navigate({ to: '/app/notifications' }) },
  ];
  const filteredNav = q ? navItems.filter(i => i.label.toLowerCase().includes(q)) : navItems;
  filteredNav.forEach(i => options.push({ ...i, group: 'Navigation' }));

  // Projects
  const filteredProjects = projects
    .filter(p => !q || p.name.toLowerCase().includes(q))
    .slice(0, 5);
  filteredProjects.forEach(p => options.push({
    id: `proj-${p.id}`,
    label: p.name,
    sublabel: `${p.task_count || 0} tasks`,
    icon: FolderKanban,
    color: p.color,
    group: 'Projects',
    action: () => navigate({ to: `/app/projects/${p.id}/board` }),
  }));

  // Tasks (search results)
  tasks.slice(0, 6).forEach(t => options.push({
    id: `task-${t.id}`,
    label: t.title,
    sublabel: t.project_name,
    icon: CheckSquare,
    group: 'Tasks',
    status: t.status,
    action: () => {
      setActiveProject(t.project_id);
      openTaskDrawer(t.id);
    },
  }));

  // Reset cursor when options change
  useEffect(() => setCursor(0), [options.length, dq]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const execute = useCallback((opt) => {
    opt.action();
    onClose();
  }, [onClose]);

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, options.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && options[cursor]) execute(options[cursor]);
    if (e.key === 'Escape') onClose();
  }

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  // Group items for rendering
  const groups = [];
  let lastGroup = null;
  options.forEach((opt, idx) => {
    if (opt.group !== lastGroup) { groups.push({ type: 'header', label: opt.group }); lastGroup = opt.group; }
    groups.push({ type: 'item', opt, idx });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <Search size={17} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search projects, tasks, pages…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs text-gray-400 bg-gray-100 dark:bg-slate-700 font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {groups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No results</p>
          )}
          {groups.map((g, gi) =>
            g.type === 'header' ? (
              <p key={`h${gi}`} className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                {g.label}
              </p>
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
                {cursor === g.idx && (
                  <kbd className="shrink-0 text-xs text-indigo-400 font-mono ml-1">↵</kbd>
                )}
              </button>
            )
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center gap-4 text-xs text-gray-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
