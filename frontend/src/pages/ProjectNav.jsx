import { Link } from '@tanstack/react-router';
import { LayoutGrid, List, Calendar, Users, Settings } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function ProjectNav({ projectId, project }) {
  const { user } = useAuthStore();
  const tabs = [
    { to: `/app/projects/${projectId}/board`,   icon: LayoutGrid, label: 'Board' },
    { to: `/app/projects/${projectId}/list`,    icon: List,        label: 'List' },
    { to: `/app/projects/${projectId}/standup`, icon: Calendar,    label: 'Standup' },
    { to: `/app/projects/${projectId}/members`, icon: Users,       label: 'Members' },
    ...(user?.role === 'admin'
      ? [{ to: `/app/projects/${projectId}/settings`, icon: Settings, label: 'Settings' }]
      : []),
  ];

  return (
    <div className="px-4 border-b border-gray-100 bg-white flex flex-row items-center shadow-sm shrink-0 overflow-x-auto">
      {/* Project colour + name */}
      <div className="flex flex-row items-center gap-2 py-3 pr-4 mr-2 border-r border-gray-100 shrink-0">
        <div
          className="w-4 h-4 rounded shrink-0"
          style={{ backgroundColor: project?.color || '#6366f1' }}
        />
        <span className="font-bold text-gray-900 text-sm whitespace-nowrap max-w-[120px] truncate">
          {project?.name || '…'}
        </span>
      </div>

      {/* Tabs — icon + label on the SAME line via flex-row */}
      <nav className="flex flex-row items-center">
        {tabs.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-row items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-2 border-transparent text-gray-500 whitespace-nowrap shrink-0 hover:text-gray-800 hover:border-gray-300 transition-colors"
            activeProps={{ className: 'border-indigo-600 !text-indigo-700' }}
          >
            <Icon size={14} className="shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
