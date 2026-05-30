import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/stores/authStore';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useUiStore } from '@/stores/uiStore';

export function AppShell() {
  const { isAuthenticated } = useAuthStore();
  const { taskDrawerOpen, selectedTaskId, activeProjectId, closeTaskDrawer } = useUiStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/login' });
  }, [isAuthenticated]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      {taskDrawerOpen && selectedTaskId && activeProjectId && (
        <TaskDetailDrawer
          projectId={activeProjectId}
          taskId={selectedTaskId}
          onClose={closeTaskDrawer}
        />
      )}
    </div>
  );
}
