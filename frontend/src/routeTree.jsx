import React, { lazy, Suspense } from 'react';
import {
  createRootRoute, createRoute, Outlet, redirect,
} from '@tanstack/react-router';
import { useAuthStore } from './stores/authStore';
import { BoardSkeleton, TableSkeleton } from './components/ui/Skeleton';

// ── Eager-loaded ──────────────────────────────────────────────────────────────
import { LoginPage }          from './pages/LoginPage';
import { RegisterPage }       from './pages/RegisterPage';
import { AcceptInvitePage }   from './pages/AcceptInvitePage';
import { OAuthCallbackPage }  from './pages/OAuthCallbackPage';
import { AppShell }           from './components/layout/AppShell';

// ── Lazy-loaded ───────────────────────────────────────────────────────────────
const DashboardPage       = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const KanbanBoardPage     = lazy(() => import('./pages/KanbanBoardPage').then((m) => ({ default: m.KanbanBoardPage })));
const TaskListPage        = lazy(() => import('./pages/TaskListPage').then((m) => ({ default: m.TaskListPage })));
const StandupPage         = lazy(() => import('./pages/StandupPage').then((m) => ({ default: m.StandupPage })));
const MembersPage         = lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const ProjectSettingsPage = lazy(() => import('./pages/ProjectSettingsPage').then((m) => ({ default: m.ProjectSettingsPage })));
const ProfilePage         = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const NotificationsPage   = lazy(() => import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const UserManagementPage  = lazy(() => import('./pages/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const BackupManagerPage   = lazy(() => import('./components/admin/BackupManager').then((m) => ({ default: m.BackupManager })));
const BillingPage         = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));

// ── Skeletons ─────────────────────────────────────────────────────────────────
const PageLoader  = () => <div className="p-6 space-y-4"><TableSkeleton rows={8} /></div>;
const BoardLoader = () => <BoardSkeleton />;
const S = (Component, Loader = PageLoader) => (props) => (
  <Suspense fallback={<Loader />}><Component {...props} /></Suspense>
);

// ── Route tree ────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: Outlet });

const loginRoute         = createRoute({ getParentRoute: () => rootRoute, path: '/login',         component: LoginPage });
const registerRoute      = createRoute({ getParentRoute: () => rootRoute, path: '/register',      component: RegisterPage });
const authCallbackRoute  = createRoute({ getParentRoute: () => rootRoute, path: '/auth/callback', component: OAuthCallbackPage });
const inviteRoute        = createRoute({ getParentRoute: () => rootRoute, path: '/invite/$token', component: AcceptInvitePage });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => { throw redirect({ to: '/app/dashboard' }); },
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated) throw redirect({ to: '/login' });
  },
  component: AppShell,
});

const routes = [
  { path: '/dashboard',                         Component: S(DashboardPage) },
  { path: '/projects/$projectId/board',         Component: S(KanbanBoardPage, BoardLoader) },
  { path: '/projects/$projectId/list',          Component: S(TaskListPage) },
  { path: '/projects/$projectId/standup',       Component: S(StandupPage) },
  { path: '/projects/$projectId/members',       Component: S(MembersPage) },
  { path: '/projects/$projectId/settings',      Component: S(ProjectSettingsPage) },
  { path: '/profile',                           Component: S(ProfilePage) },
  { path: '/notifications',                     Component: S(NotificationsPage) },
  { path: '/billing',                           Component: S(BillingPage) },
  { path: '/admin/users',                       Component: S(UserManagementPage) },
  { path: '/admin/backups',                     Component: S(BackupManagerPage) },
].map(({ path, Component }) =>
  createRoute({ getParentRoute: () => appRoute, path, component: Component })
);

export const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authCallbackRoute,
  inviteRoute,
  indexRoute,
  appRoute.addChildren(routes),
]);
