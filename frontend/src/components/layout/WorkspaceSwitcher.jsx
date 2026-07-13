import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Building2, Loader2 } from 'lucide-react';
import { useWorkspaces, useCreateWorkspace } from '@/hooks/useWorkspaces';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';

function WorkspaceAvatar({ name, size = 'sm' }) {
  const letter = name?.charAt(0).toUpperCase() || '?';
  const colors = ['from-indigo-400 to-indigo-600', 'from-purple-400 to-purple-600',
    'from-pink-400 to-pink-600', 'from-emerald-400 to-emerald-600', 'from-amber-400 to-amber-600'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const cls = size === 'sm'
    ? 'w-6 h-6 text-[10px]'
    : 'w-8 h-8 text-sm';
  return (
    <div className={cn('rounded-md bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0', color, cls)}>
      {letter}
    </div>
  );
}

export function WorkspaceSwitcher() {
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();
  const createWorkspace = useCreateWorkspace();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const current = workspaces.find((w) => w.id === currentWorkspaceId) || workspaces[0];

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (creating) setTimeout(() => inputRef.current?.focus(), 50);
  }, [creating]);

  function handleSwitch(id) {
    setCurrentWorkspace(id);
    setOpen(false);
  }

  function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    createWorkspace.mutate({ name: newName.trim() }, {
      onSuccess: () => { setCreating(false); setNewName(''); setOpen(false); },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-1 py-1">
        <Loader2 size={14} className="animate-spin text-gray-400 dark:text-slate-500" />
        <span className="text-sm text-gray-400 dark:text-slate-500">Loading…</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full rounded-xl px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors group"
      >
        {current ? (
          <>
            <WorkspaceAvatar name={current.name} />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight truncate">{current.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight capitalize">{current.plan} plan</p>
            </div>
          </>
        ) : (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm text-gray-400 dark:text-slate-400">No workspace</p>
          </div>
        )}
        <ChevronDown size={12} className="text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 py-1 overflow-hidden">
          {/* Workspace list */}
          <div className="px-2 py-1">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest px-2 py-1">Workspaces</p>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                className="flex items-center gap-2.5 w-full px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <WorkspaceAvatar name={ws.name} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm text-gray-800 dark:text-white font-medium truncate">{ws.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">{ws.member_count} member{ws.member_count !== 1 ? 's' : ''} · {ws.project_count} project{ws.project_count !== 1 ? 's' : ''}</p>
                </div>
                {ws.id === currentWorkspaceId && <Check size={14} className="text-indigo-500 shrink-0" />}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 dark:border-slate-700 my-1" />

          {/* Create new workspace */}
          <div className="px-2 pb-1">
            {creating ? (
              <form onSubmit={handleCreate} className="px-2 py-1 space-y-2">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!newName.trim() || createWorkspace.isPending}
                    className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-1.5 font-medium transition-colors"
                  >
                    {createWorkspace.isPending ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(''); }}
                    className="text-xs text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white px-2 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                <Plus size={14} />
                <span className="text-sm">New workspace</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
