import { Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/stores/authStore';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useUiStore } from '@/stores/uiStore';
import { QuickCreateButton } from '@/components/shared/QuickCreateButton';
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function AppShell() {
  const { isAuthenticated } = useAuthStore();
  const { taskDrawerOpen, selectedTaskId, activeProjectId, closeTaskDrawer, sidebarOpen, toggleSidebar } = useUiStore();
  const navigate = useNavigate();

  // Register global keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/login' });
  }, [isAuthenticated]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Mobile overlay behind sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}
      `}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
        <Topbar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Drawers & overlays */}
      {taskDrawerOpen && selectedTaskId && activeProjectId && (
        <TaskDetailDrawer
          projectId={activeProjectId}
          taskId={selectedTaskId}
          onClose={closeTaskDrawer}
        />
      )}

      {/* Floating buttons */}
      <QuickCreateButton />
      <KeyboardShortcutsHelp />
    </div>
  );
}
