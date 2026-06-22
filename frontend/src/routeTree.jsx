import React, { lazy, Suspense } from 'react';
import {
  createRootRoute, createRoute, Outlet, redirect,
} from '@tanstack/react-router';
import { useAuthStore } from './stores/authStore';
import { BoardSkeleton, TableSkeleton } from './components/ui/Skeleton';
import { CookieBanner } from './components/shared/CookieBanner';
import { ContactModal } from './components/shared/ContactModal';

function RootLayout() {
  return (
    <>
      <Outlet />
      <CookieBanner />
      <ContactModal />
    </>
  );
}

// ── Eager-loaded ──────────────────────────────────────────────────────────────
import { LoginPage }           from './pages/LoginPage';
import { RegisterPage }        from './pages/RegisterPage';
import { AcceptInvitePage }    from './pages/AcceptInvitePage';
import { OAuthCallbackPage }   from './pages/OAuthCallbackPage';
import { ForgotPasswordPage }  from './pages/ForgotPasswordPage';
import { ResetPasswordPage }   from './pages/ResetPasswordPage';
import { VerifyEmailPage }     from './pages/VerifyEmailPage';
import { PrivacyPolicyPage }   from './pages/PrivacyPolicyPage';
import { TermsPage }           from './pages/TermsPage';
import { NotFoundPage }        from './pages/NotFoundPage';
import { LandingPage }         from './pages/LandingPage';
import { AppShell }            from './components/layout/AppShell';

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
const CalendarPage        = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const WorkloadPage        = lazy(() => import('./pages/WorkloadPage').then((m) => ({ default: m.WorkloadPage })));
const AutomationsPage     = lazy(() => import('./pages/AutomationsPage').then((m) => ({ default: m.AutomationsPage })));
const TimeReportPage      = lazy(() => import('./pages/TimeReportPage').then((m) => ({ default: m.TimeReportPage })));
const GanttPage           = lazy(() => import('./pages/GanttPage').then((m) => ({ default: m.GanttPage })));
const SprintsPage         = lazy(() => import('./pages/SprintsPage').then((m) => ({ default: m.SprintsPage })));
const SprintDetailPage    = lazy(() => import('./pages/SprintDetailPage').then((m) => ({ default: m.SprintDetailPage })));
const EpicsPage           = lazy(() => import('./pages/EpicsPage').then((m) => ({ default: m.EpicsPage })));
const AuditLogPage        = lazy(() => import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const PublicSharePage     = lazy(() => import('./pages/PublicSharePage').then((m) => ({ default: m.PublicSharePage })));
const GuestViewPage       = lazy(() => import('./pages/GuestViewPage').then((m) => ({ default: m.GuestViewPage })));
const AnalyticsPage         = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const WorkspaceSettingsPage = lazy(() => import('./pages/WorkspaceSettingsPage').then((m) => ({ default: m.WorkspaceSettingsPage })));
const MySpacePage           = lazy(() => import('./pages/MySpacePage').then((m) => ({ default: m.MySpacePage })));
const MilestonesPage        = lazy(() => import('./pages/MilestonesPage').then((m) => ({ default: m.MilestonesPage })));
const OKRsPage              = lazy(() => import('./pages/OKRsPage').then((m) => ({ default: m.OKRsPage })));
const SearchPage            = lazy(() => import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })));

// ── Skeletons ─────────────────────────────────────────────────────────────────
const PageLoader  = () => <div className="p-6 space-y-4"><TableSkeleton rows={8} /></div>;
const BoardLoader = () => <BoardSkeleton />;
const S = (Component, Loader = PageLoader) => (props) => (
  <Suspense fallback={<Loader />}><Component {...props} /></Suspense>
);

// ── Route tree ────────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({ component: RootLayout });

const loginRoute          = createRoute({ getParentRoute: () => rootRoute, path: '/login',                   component: LoginPage });
const registerRoute       = createRoute({ getParentRoute: () => rootRoute, path: '/register',                component: RegisterPage });
const authCallbackRoute   = createRoute({ getParentRoute: () => rootRoute, path: '/auth/callback',           component: OAuthCallbackPage });
const inviteRoute         = createRoute({ getParentRoute: () => rootRoute, path: '/invite/$token',           component: AcceptInvitePage });
const forgotPasswordRoute = createRoute({ getParentRoute: () => rootRoute, path: '/forgot-password',         component: ForgotPasswordPage });
const resetPasswordRoute  = createRoute({ getParentRoute: () => rootRoute, path: '/reset-password/$token',  component: ResetPasswordPage });
const verifyEmailRoute    = createRoute({ getParentRoute: () => rootRoute, path: '/verify-email/$token',     component: VerifyEmailPage });
const privacyRoute        = createRoute({ getParentRoute: () => rootRoute, path: '/privacy',                 component: PrivacyPolicyPage });
const termsRoute          = createRoute({ getParentRoute: () => rootRoute, path: '/terms',                   component: TermsPage });
const publicShareRoute    = createRoute({ getParentRoute: () => rootRoute, path: '/share/$token',             component: S(PublicSharePage) });
const guestViewRoute      = createRoute({ getParentRoute: () => rootRoute, path: '/guest/$token',             component: S(GuestViewPage) });
const notFoundRoute       = createRoute({ getParentRoute: () => rootRoute, path: '*',                        component: NotFoundPage });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
  beforeLoad: () => {
    if (useAuthStore.getState().isAuthenticated) throw redirect({ to: '/app/dashboard' });
  },
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/app',
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated) throw redirect({ to: '/login' });
  },
  component: AppShell,
});

// Redirect routes for convenience URLs
const projectsIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects',
  beforeLoad: () => { throw redirect({ to: '/app/dashboard' }); },
});

const adminIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/admin',
  beforeLoad: () => { throw redirect({ to: '/app/admin/users' }); },
});

const projectIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/projects/$projectId',
  beforeLoad: ({ params }) => { throw redirect({ to: `/app/projects/${params.projectId}/board` }); },
});

const routes = [
  { path: '/dashboard',                         Component: S(DashboardPage) },
  { path: '/projects/$projectId/board',         Component: S(KanbanBoardPage, BoardLoader) },
  { path: '/projects/$projectId/list',          Component: S(TaskListPage) },
  { path: '/projects/$projectId/calendar',      Component: S(CalendarPage) },
  { path: '/projects/$projectId/workload',      Component: S(WorkloadPage) },
  { path: '/projects/$projectId/automations',   Component: S(AutomationsPage) },
  { path: '/projects/$projectId/standup',       Component: S(StandupPage) },
  { path: '/projects/$projectId/time-report',   Component: S(TimeReportPage) },
  { path: '/projects/$projectId/gantt',         Component: S(GanttPage) },
  { path: '/projects/$projectId/sprints',       Component: S(SprintsPage) },
  { path: '/projects/$projectId/sprints/$sprintId', Component: S(SprintDetailPage) },
  { path: '/projects/$projectId/epics',         Component: S(EpicsPage) },
  { path: '/projects/$projectId/milestones',   Component: S(MilestonesPage) },
  { path: '/projects/$projectId/okrs',         Component: S(OKRsPage) },
  { path: '/projects/$projectId/members',       Component: S(MembersPage) },
  { path: '/projects/$projectId/settings',      Component: S(ProjectSettingsPage) },
  { path: '/search',                              Component: S(SearchPage) },
  { path: '/my-space',                           Component: S(MySpacePage) },
  { path: '/profile',                           Component: S(ProfilePage) },
  { path: '/notifications',                     Component: S(NotificationsPage) },
  { path: '/billing',                           Component: S(BillingPage) },
  { path: '/admin/users',                       Component: S(UserManagementPage) },
  { path: '/admin/backups',                     Component: S(BackupManagerPage) },
  { path: '/admin/audit-log',                   Component: S(AuditLogPage) },
  { path: '/analytics',                                 Component: S(AnalyticsPage) },
  { path: '/workspaces/$workspaceId/settings',          Component: S(WorkspaceSettingsPage) },
].map(({ path, Component }) =>
  createRoute({ getParentRoute: () => appRoute, path, component: Component })
);

export const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authCallbackRoute,
  inviteRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  verifyEmailRoute,
  privacyRoute,
  termsRoute,
  indexRoute,
  publicShareRoute,
  guestViewRoute,
  appRoute.addChildren([...routes, projectsIndexRoute, adminIndexRoute, projectIndexRoute]),
  notFoundRoute,
]);
