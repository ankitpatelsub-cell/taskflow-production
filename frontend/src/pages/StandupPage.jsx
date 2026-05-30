import { useParams } from '@tanstack/react-router';
import { useProject } from '@/hooks/useProjects';
import { StandupView } from '@/components/standup/StandupView';
import { ProjectNav } from './ProjectNav';

export function StandupPage() {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  return (
    <div className="h-full flex flex-col">
      <ProjectNav projectId={projectId} project={project} />
      <div className="flex-1 overflow-auto">
        <StandupView projectId={projectId} />
      </div>
    </div>
  );
}
