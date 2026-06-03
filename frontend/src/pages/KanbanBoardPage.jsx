import { useState, useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { KanbanFilters } from '@/components/board/KanbanFilters';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';
import { subscribeProject, unsubscribeProject, useWsEvent } from '@/hooks/useWebSocket';
import { queryClient } from '@/lib/queryClient';

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

  const FILTER_KEY = `kf_${projectId}`;
  const [filters, setFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY)) || { assignee: '', priority: '', tag: '', q: '', to: '' }; }
    catch { return { assignee: '', priority: '', tag: '', q: '', to: '' }; }
  });

  useEffect(() => {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(filters)); } catch {}
  }, [filters, FILTER_KEY]);

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
