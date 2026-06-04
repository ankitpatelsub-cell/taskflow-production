import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuthStore } from '@/stores/authStore';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { useUiStore } from '@/stores/uiStore';
import { QuickCreateButton } from '@/components/shared/QuickCreateButton';
import { KeyboardShortcutsHelp } from '@/components/shared/KeyboardShortcutsHelp';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { OnboardingChecklist } from '@/components/shared/OnboardingChecklist';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ToastProvider } from '@/components/ui/Toast';
import { useThemeStore } from '@/stores/themeStore';
import { connectWebSocket, disconnectWebSocket } from '@/hooks/useWebSocket';
import { useDesktopNotifications } from '@/hooks/useDesktopNotifications';

export function AppShell() {
  const { isAuthenticated, accessToken } = useAuthStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const { taskDrawerOpen, selectedTaskId, activeProjectId, closeTaskDrawer, sidebarOpen, toggleSidebar } = useUiStore();
  const navigate = useNavigate();
  const { initTheme } = useThemeStore();
  const { location } = useRouterState();

  // Dynamic document title
  useEffect(() => {
    const path = location.pathname;
    let title = 'TaskFlow';
    if (path.includes('/board'))        title = 'Board | TaskFlow';
    else if (path.includes('/list'))    title = 'List | TaskFlow';
    else if (path.includes('/calendar')) title = 'Calendar | TaskFlow';
    else if (path.includes('/standup')) title = 'Standup | TaskFlow';
    else if (path.includes('/members')) title = 'Members | TaskFlow';
    else if (path.includes('/settings')) title = 'Settings | TaskFlow';
    else if (path.includes('/dashboard')) title = 'Dashboard | TaskFlow';
    else if (path.includes('/notifications')) title = 'Notifications | TaskFlow';
    else if (path.includes('/profile')) title = 'My Profile | TaskFlow';
    else if (path.includes('/billing')) title = 'Billing | TaskFlow';
    else if (path.includes('/admin/users')) title = 'User Management | TaskFlow';
    else if (path.includes('/admin/backups')) title = 'Backups | TaskFlow';
    document.title = title;
  }, [location.pathname]);

  useKeyboardShortcuts();
  useDesktopNotifications();

  useEffect(() => {
    if (!isAuthenticated) navigate({ to: '/login' });
  }, [isAuthenticated]);

  // On page refresh the access token is gone (memory only) but isAuthenticated
  // persists. Trigger a silent refresh so the token is restored before any
  // child component fires an API call.
  useEffect(() => {
    if (isAuthenticated && !accessToken) {
      import('@/lib/api').then(({ default: api }) => {
        api.post('/auth/refresh').then(({ data }) => {
          useAuthStore.getState().setToken(data.accessToken);
        }).catch(() => {
          useAuthStore.getState().logout();
        });
      });
    }
  }, []);

  // Connect WebSocket when authenticated
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectWebSocket(accessToken);
      return () => disconnectWebSocket();
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => { initTheme(); }, []);

  // Global ⌘K / Ctrl+K handler
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto
        transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}
      `}>
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 w-full">
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

      <QuickCreateButton />
      <KeyboardShortcutsHelp />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <OnboardingChecklist />
      <ToastProvider />
    </div>
  );
}
