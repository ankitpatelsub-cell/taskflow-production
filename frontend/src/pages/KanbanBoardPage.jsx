import { useState, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { KanbanFilters } from '@/components/board/KanbanFilters';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { subscribeProject, unsubscribeProject, useWsEvent } from '@/hooks/useWebSocket';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/Button';
import { ClipboardList } from 'lucide-react';
import { MeetingNotesModal } from '@/components/shared/MeetingNotesModal';

const EMPTY_FILTERS = { assignee: '', priority: '', tag: '', q: '', to: '' };

export function KanbanBoardPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);

  // Subscribe to real-time project events
  useEffect(() => {
    if (!projectId) return;
    subscribeProject(projectId);
    return () => unsubscribeProject(projectId);
  }, [projectId]);

  // Invalidate task queries on real-time events
  useWsEvent('task:created',      () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }));
  useWsEvent('task:updated',      () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }));
  useWsEvent('task:deleted',      () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }));
  useWsEvent('tasks:bulk_updated',() => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }));
  useWsEvent('comment:created',   () => queryClient.invalidateQueries({ queryKey: ['task'] }));

  const filterKey = projectId ? `kf_${projectId}` : null;
  const [filters, setFilters] = useState(() => {
    if (!filterKey) return EMPTY_FILTERS;
    try { return JSON.parse(localStorage.getItem(filterKey)) || EMPTY_FILTERS; }
    catch { return EMPTY_FILTERS; }
  });

  // Router re-uses this component instance on project navigation — reload persisted filters for the new project
  useEffect(() => {
    if (!filterKey) { setFilters(EMPTY_FILTERS); return; }
    try { setFilters(JSON.parse(localStorage.getItem(filterKey)) || EMPTY_FILTERS); }
    catch { setFilters(EMPTY_FILTERS); }
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!filterKey) return;
    try { localStorage.setItem(filterKey, JSON.stringify(filters)); } catch {}
  }, [filters, filterKey]);

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />

      {/* Filter bar */}
      <div className="px-6 py-2.5 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-between shrink-0">
        <p className="text-xs text-gray-400 dark:text-slate-500">Drag cards between columns to update status</p>
        <KanbanFilters projectId={projectId} filters={filters} onChange={setFilters} />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard projectId={projectId} filters={filters} />
      </div>
    </div>
  );
}
