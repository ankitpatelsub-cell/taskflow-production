import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard, Bell, User, Shield, Plus, ChevronDown,
  ChevronRight, Database, LogOut, CreditCard, Settings,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useProjects } from '@/hooks/useProjects';
import { useUiStore } from '@/stores/uiStore';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { isAdminOrAbove, isSuperAdmin } from '@/lib/roles';
import { useState } from 'react';
import { CreateProjectModal } from '@/components/shared/CreateProjectModal';
import { useLogout } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorkspaces } from '@/hooks/useWorkspaces';

// ─── Single nav item (icon + label on ONE row) ────────────────────────────────
function NavItem({ to, icon: Icon, children, badge }) {
  return (
    <Link
      to={to}
      className="flex flex-row items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all w-full whitespace-nowrap"
      activeProps={{ className: 'bg-white/15 text-white shadow-sm' }}
      inactiveProps={{ className: 'text-slate-400 hover:bg-white/10 hover:text-white' }}
    >
      <Icon size={15} className="shrink-0" />
      <span className="flex-1 truncate">{children}</span>
      {badge > 0 && (
        <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="px-3 pt-3 pb-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
      {children}
    </p>
  );
}

export function Sidebar() {
  const { sidebarOpen } = useUiStore();
  const { user } = useAuthStore();
  const { data: projects = [] } = useProjects();
  const { data: notifData } = useNotifications();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  const router = useRouterState();
  const { t } = useTranslation();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspaces();

  if (!sidebarOpen) return null;

  const activeProjects = projects.filter((p) => p.status === 'active');
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const canCreateProject = currentWorkspace &&
    (currentWorkspace.member_role === 'owner' || currentWorkspace.member_role === 'admin' ||
     isAdminOrAbove(user?.role));
  const unreadCount = notifData?.unread_count || 0;
  const currentPath = router.location.pathname;

  return (
    <>
      <aside className="sidebar-width shrink-0 h-full flex flex-col overflow-hidden bg-slate-900">

        {/* ── Workspace Switcher ────────────────────────────── */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-md flex items-center justify-center shadow shrink-0">
              <span className="text-white text-[10px] font-black">T</span>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tick</span>
            {currentWorkspaceId && (
              <button
                onClick={() => navigate({ to: `/app/workspaces/${currentWorkspaceId}/settings` })}
                className="ml-auto text-slate-600 hover:text-slate-400 transition-colors p-0.5 rounded"
                title="Workspace settings"
              >
                <Settings size={12} />
              </button>
            )}
          </div>
          <WorkspaceSwitcher />
        </div>

        <div className="mx-4 border-t border-slate-800 shrink-0" />

        {/* ── Scrollable nav ────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 sidebar-scroll">

          {/* Search hint */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors mb-1"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span className="flex-1 text-left text-xs">{t('common.search')}…</span>
            <kbd className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1 py-0.5 font-mono leading-none">⌘K</kbd>
          </button>

          <SectionLabel>{t('nav.menu')}</SectionLabel>
          <NavItem to="/app/dashboard" icon={LayoutDashboard}>{t('nav.dashboard')}</NavItem>
          <NavItem to="/app/notifications" icon={Bell} badge={unreadCount}>{t('nav.notifications')}</NavItem>
          <NavItem to="/app/profile" icon={User}>{t('nav.profile')}</NavItem>
          {isAdminOrAbove(user?.role) && (
            <NavItem to="/app/billing" icon={CreditCard}>{t('nav.billing')}</NavItem>
          )}

          {/* ── Projects ──── */}
          <div className="pt-1">
            <button
              onClick={() => setProjectsOpen((o) => !o)}
              className="flex flex-row items-center justify-between w-full px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
            >
              <span>{t('nav.projects')}</span>
              <span className="flex items-center gap-1">
                {canCreateProject && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setShowCreateProject(true); }}
                    className="hover:text-indigo-400 cursor-pointer p-0.5 rounded hover:bg-white/10"
                    title={t('nav.newProject')}
                  >
                    <Plus size={12} />
                  </span>
                )}
                {projectsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </span>
            </button>

            {projectsOpen && (
              <div className="mt-1 space-y-0.5">
                {activeProjects.map((p) => {
                  const isActive = currentPath.includes(`/projects/${p.id}`);
                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate({ to: `/app/projects/${p.id}/board` })}
                      className={cn(
                        'flex flex-row items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all text-left',
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-slate-400 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="truncate flex-1 text-sm">{p.name}</span>
                      <span className="text-xs text-slate-600 shrink-0 tabular-nums">{p.task_count || 0}</span>
                    </button>
                  );
                })}
                {activeProjects.length === 0 && (
                  <p className="px-3 py-2 text-xs text-slate-600 italic">
                    {isAdminOrAbove(user?.role) ? t('dashboard.noProjects') : t('dashboard.noProjectsAssigned')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Admin ──── */}
          {isAdminOrAbove(user?.role) && (
            <div className="pt-1 border-t border-slate-800 mt-2">
              <SectionLabel>{t('nav.admin')}</SectionLabel>
              <NavItem to="/app/admin/users" icon={Shield}>{t('nav.userManagement')}</NavItem>
              {isSuperAdmin(user?.role) && (
                <NavItem to="/app/admin/backups" icon={Database}>{t('nav.backups')}</NavItem>
              )}
            </div>
          )}
        </nav>

        {/* ── Version ──────────────────────────────────────── */}
        <div className="px-4 pb-1 shrink-0">
          <p className="text-[10px] text-slate-700 select-none">v1.0.0</p>
        </div>

        {/* ── Bottom user card ──────────────────────────────── */}
        <div className="shrink-0 p-3 border-t border-slate-800">
          <div
            className="flex flex-row items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group"
            onClick={() => navigate({ to: '/app/profile' })}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</p>
              <p className="text-[11px] text-slate-500 capitalize leading-tight">{user?.role}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); logout.mutate(); }}
              className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded opacity-0 group-hover:opacity-100 shrink-0"
              title={t('nav.signOut')}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
    </>
  );
}
