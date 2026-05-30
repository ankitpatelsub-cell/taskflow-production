import { useParams } from '@tanstack/react-router';
import { KanbanBoard } from '@/components/board/KanbanBoard';
import { useProject } from '@/hooks/useProjects';
import { ProjectNav } from './ProjectNav';

export function KanbanBoardPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);

  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="flex-1 overflow-hidden">
        <KanbanBoard projectId={projectId} />
      </div>
    </div>
  );
}
