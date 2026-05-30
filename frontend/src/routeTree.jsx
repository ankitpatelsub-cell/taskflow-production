import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Outlet,
} from '@tanstack/react-router';
import { useAuthStore } from './stores/authStore';

import { LoginPage } from './pages/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { KanbanBoardPage } from './pages/KanbanBoardPage';
import { TaskListPage } from './pages/TaskListPage';
import { StandupPage } from './pages/StandupPage';
import { MembersPage } from './pages/MembersPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { BackupManager } from './components/admin/BackupManager';

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/app/dashboard' }); },
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const projectBoardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId/board',
  component: KanbanBoardPage,
});

const projectListRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId/list',
  component: TaskListPage,
});

const projectStandupRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId/standup',
  component: StandupPage,
});

const projectMembersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId/members',
  component: MembersPage,
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId/settings',
  component: ProjectSettingsPage,
});

const profileRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/profile',
  component: ProfilePage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/admin/users',
  component: UserManagementPage,
});

const adminBackupsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/admin/backups',
  component: () => <BackupManager />,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  appRoute.addChildren([
    dashboardRoute,
    projectBoardRoute,
    projectListRoute,
    projectStandupRoute,
    projectMembersRoute,
    projectSettingsRoute,
    profileRoute,
    notificationsRoute,
    adminUsersRoute,
    adminBackupsRoute,
  ]),
]);
