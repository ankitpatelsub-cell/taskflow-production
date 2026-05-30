import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { KanbanFilters } from '@/components/board/KanbanFilters';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';

export function KanbanBoardPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const [filters, setFilters] = useState({ assignee: '', priority: '', tag: '', q: '' });

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
