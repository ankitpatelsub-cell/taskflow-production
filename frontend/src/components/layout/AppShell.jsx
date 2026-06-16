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
import { EmailVerificationBanner } from '@/components/shared/EmailVerificationBanner';
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
    let title = 'Tick';
    if (path.includes('/board'))           title = 'Board | Tick';
    else if (path.includes('/list'))       title = 'List | Tick';
    else if (path.includes('/calendar'))   title = 'Calendar | Tick';
    else if (path.includes('/standup'))    title = 'Standup | Tick';
    else if (path.includes('/members'))    title = 'Members | Tick';
    else if (path.includes('/settings'))   title = 'Settings | Tick';
    else if (path.includes('/dashboard'))  title = 'Dashboard | Tick';
    else if (path.includes('/notifications')) title = 'Notifications | Tick';
    else if (path.includes('/profile'))    title = 'My Profile | Tick';
    else if (path.includes('/billing'))    title = 'Billing | Tick';
    else if (path.includes('/admin/users'))      title = 'User Management | Tick';
    else if (path.includes('/admin/backups'))     title = 'Backups | Tick';
    else if (path.includes('/admin/audit-log'))   title = 'Audit Log | Tick';
    else if (path.includes('/my-space'))     title = 'My Space | Tick';
    else if (path.includes('/analytics'))    title = 'Analytics | Tick';
    else if (path.includes('/sprints'))      title = 'Sprints | Tick';
    else if (path.includes('/epics'))        title = 'Epics | Tick';
    else if (path.includes('/workload'))     title = 'Workload | Tick';
    else if (path.includes('/automations'))  title = 'Automations | Tick';
    else if (path.includes('/time-report'))  title = 'Time Report | Tick';
    else if (path.includes('/gantt'))        title = 'Gantt | Tick';
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
        <EmailVerificationBanner />
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
