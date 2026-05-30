import { useProjects } from '@/hooks/useProjects';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from '@tanstack/react-router';
import { FolderKanban, CheckCircle2, Archive, Users, ArrowRight } from 'lucide-react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const navigate = useNavigate();

  const totalTasks = projects.reduce((s, p) => s + (p.task_count || 0), 0);
  const activeProjectsCount = projects.filter((p) => p.status === 'active').length;
  const totalMembers = projects.reduce((s, p) => s + (p.member_count || 0), 0);
  const archivedCount = projects.filter((p) => p.status === 'archived').length;

  const stats = [
    { label: 'Active Projects', value: activeProjectsCount, icon: FolderKanban, gradient: 'from-indigo-500 to-indigo-600' },
    { label: 'Total Tasks', value: totalTasks, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600' },
    { label: 'Members', value: totalMembers, icon: Users, gradient: 'from-blue-500 to-blue-600' },
    { label: 'Archived', value: archivedCount, icon: Archive, gradient: 'from-gray-400 to-gray-500' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto page-fade">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.name?.split(' ')[0]}!
        </h2>
        <p className="text-gray-500 mt-1">Here's your workspace overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, gradient }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-sm`}>
              <Icon size={20} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-800">Active Projects</h3>
          <span className="text-sm text-gray-400">{activeProjectsCount} projects</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.filter((p) => p.status === 'active').map((p) => (
            <div
              key={p.id}
              onClick={() => navigate({ to: `/app/projects/${p.id}/board` })}
              className="group bg-white rounded-xl border border-gray-100 p-5 cursor-pointer hover:shadow-md hover:border-indigo-100 transition-all shadow-sm overflow-hidden"
              style={{ borderTop: `3px solid ${p.color}` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                </div>
                <ArrowRight
                  size={15}
                  className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5"
                />
              </div>
              {p.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-4">{p.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={11} /> {p.task_count} tasks
                </span>
                <span className="flex items-center gap-1">
                  <Users size={11} /> {p.member_count} members
                </span>
              </div>
            </div>
          ))}
          {projects.length === 0 && (
            <div className="col-span-3 text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
              <FolderKanban size={40} className="mx-auto mb-3 text-gray-200" />
              <p className="font-medium text-gray-500 mb-1">No projects yet</p>
              <p className="text-sm text-gray-400">
                {user?.role === 'admin' ? 'Create one from the sidebar.' : 'Ask an admin to add you to a project.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
