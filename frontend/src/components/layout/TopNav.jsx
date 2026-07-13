import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  LayoutDashboard, Bell, Shield, Plus, ChevronDown, Menu, X,
  Database, CreditCard, BarChart3, Settings, Lock, HelpCircle,
  Sun, Moon, Monitor, Search, User, LogOut, FolderKanban,
} from 'lucide-react';
import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { useThemeStore } from '@/stores/themeStore';
import { useProjects } from '@/hooks/useProjects';
import { useNotifications } from '@/hooks/useNotifications';
import { useLogout } from '@/hooks/useAuth';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { isAdminOrAbove, isSuperAdmin } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { CreateProjectModal } from '@/components/shared/CreateProjectModal';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useTranslation } from 'react-i18next';

function openCommandPalette() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
}

// Horizontal nav pill — soft rounded active state matching the design language
function NavPill({ to, icon: Icon, children, badge }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
      activeProps={{ className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' }}
      inactiveProps={{ className: 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700' }}
    >
      {Icon && <Icon size={15} className="shrink-0" />}
      <span>{children}</span>
      {badge > 0 && (
        <span className="bg-coral-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

const menuItemCls = 'flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer focus:outline-none rounded-xl mx-1 transition-colors';
const menuContentCls = 'bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 min-w-52 z-50';

export function TopNav() {
  const { sidebarOpen: mobileNavOpen, toggleSidebar: toggleMobileNav, openContact } = useUiStore();
  const { user } = useAuthStore();
  const { theme, cycleTheme } = useThemeStore();
  const { data: projects = [] } = useProjects();
  const { data: notifData } = useNotifications();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces = [] } = useWorkspaces();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const navigate = useNavigate();
  const logout = useLogout();
  const router = useRouterState();
  const { t } = useTranslation();

  const currentPath = router.location.pathname;
  const activeProjects = projects.filter((p) => p.status === 'active');
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId);
  const canCreateProject = isAdminOrAbove(user?.role) ||
    (currentWorkspace && (currentWorkspace.member_role === 'owner' || currentWorkspace.member_role === 'admin'));
  const unreadCount = notifData?.unread_count || 0;
  const onProjectPage = currentPath.includes('/projects/');
  const activeProject = activeProjects.find((p) => currentPath.includes(`/projects/${p.id}`));

  function goToProject(id) {
    navigate({ to: `/app/projects/${id}/board` });
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <>
      <header className="h-16 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4 gap-3 shrink-0 shadow-sm relative z-40">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleMobileNav}
          className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title="Toggle navigation"
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {/* Brand */}
        <Link to="/app/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-coral-400 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-black">T</span>
          </div>
          <span className="text-lg font-extrabold text-gray-900 dark:text-white tracking-tight hidden sm:block">Tick</span>
        </Link>

        {/* Workspace switcher */}
        <div className="hidden md:block w-44 shrink-0 border-l border-gray-100 dark:border-slate-700 pl-3">
          <WorkspaceSwitcher />
        </div>

        {/* Primary nav — desktop */}
        <nav className="hidden lg:flex items-center gap-1 ml-2">
          <NavPill to="/app/dashboard" icon={LayoutDashboard}>{t('nav.dashboard')}</NavPill>
          <NavPill to="/app/my-space" icon={Lock}>My Space</NavPill>
          <NavPill to="/app/analytics" icon={BarChart3}>Analytics</NavPill>

          {/* Projects dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className={cn(
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap focus:outline-none',
                onProjectPage
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700'
              )}>
                <FolderKanban size={15} className="shrink-0" />
                <span className="max-w-40 truncate">{activeProject ? activeProject.name : t('nav.projects')}</span>
                <ChevronDown size={13} className="shrink-0 opacity-60" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className={cn(menuContentCls, 'min-w-64')} align="start" sideOffset={8}>
                <p className="px-4 pt-1.5 pb-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                  {t('nav.projects')}
                </p>
                {activeProjects.map((p) => {
                  const isActive = currentPath.includes(`/projects/${p.id}`);
                  return (
                    <DropdownMenu.Item
                      key={p.id}
                      className={cn(menuItemCls, isActive && 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold')}
                      onSelect={() => goToProject(p.id)}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">{p.task_count || 0}</span>
                    </DropdownMenu.Item>
                  );
                })}
                {activeProjects.length === 0 && (
                  <p className="px-4 py-2 text-xs text-gray-400 dark:text-slate-500 italic">
                    {isAdminOrAbove(user?.role) ? t('dashboard.noProjects') : t('dashboard.noProjectsAssigned')}
                  </p>
                )}
                {canCreateProject && (
                  <>
                    <DropdownMenu.Separator className="border-t border-gray-50 dark:border-slate-700 my-1" />
                    <DropdownMenu.Item className={cn(menuItemCls, 'text-indigo-600 dark:text-indigo-400')} onSelect={() => setShowCreateProject(true)}>
                      <Plus size={14} />
                      {t('nav.newProject')}
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Admin dropdown */}
          {isAdminOrAbove(user?.role) && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className={cn(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap focus:outline-none',
                  currentPath.includes('/admin/')
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700'
                )}>
                  <Shield size={15} className="shrink-0" />
                  <span>{t('nav.admin')}</span>
                  <ChevronDown size={13} className="shrink-0 opacity-60" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={menuContentCls} align="start" sideOffset={8}>
                  <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: '/app/admin/users' })}>
                    <Shield size={14} /> {t('nav.userManagement')}
                  </DropdownMenu.Item>
                  {isSuperAdmin(user?.role) && (
                    <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: '/app/admin/backups' })}>
                      <Database size={14} /> {t('nav.backups')}
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </nav>

        <div className="flex-1" />

        {/* Search hint */}
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full hover:bg-gray-100 dark:hover:bg-slate-600 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          <Search size={13} />
          <span className="text-xs">{t('common.search')}…</span>
          <kbd className="text-[10px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5 font-mono leading-none">⌘K</kbd>
        </button>
        {/* Mobile search icon */}
        <button
          onClick={openCommandPalette}
          className="sm:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title="Search"
        >
          <Search size={18} />
        </button>

        {/* Theme cycle */}
        <button
          onClick={cycleTheme}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title={theme === 'dark' ? 'Theme: Dark' : theme === 'light' ? 'Theme: Light' : 'Theme: System (auto)'}
        >
          <ThemeIcon size={18} />
        </button>

        <NotificationBell />

        {/* User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none border border-transparent hover:border-gray-100 dark:hover:border-slate-600">
              <Avatar name={user?.name} src={user?.avatar_url} size="sm" />
              <ChevronDown size={13} className="text-gray-400 hidden sm:block" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={menuContentCls} align="end" sideOffset={8}>
              <div className="px-4 py-2 border-b border-gray-50 dark:border-slate-700 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize mt-0.5">{user?.role}</p>
              </div>
              <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: '/app/profile' })}>
                <User size={14} /> {t('nav.profile')}
              </DropdownMenu.Item>
              <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: '/app/notifications' })}>
                <Bell size={14} /> {t('nav.notifications')}
                {unreadCount > 0 && (
                  <span className="ml-auto bg-coral-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </DropdownMenu.Item>
              {isAdminOrAbove(user?.role) && (
                <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: '/app/billing' })}>
                  <CreditCard size={14} /> {t('nav.billing')}
                </DropdownMenu.Item>
              )}
              {currentWorkspaceId && (
                <DropdownMenu.Item className={menuItemCls} onSelect={() => navigate({ to: `/app/workspaces/${currentWorkspaceId}/settings` })}>
                  <Settings size={14} /> Workspace settings
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item className={menuItemCls} onSelect={openContact}>
                <HelpCircle size={14} /> Contact Us
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="border-t border-gray-50 dark:border-slate-700 my-1" />
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer focus:outline-none rounded-xl mx-1 transition-colors"
                onSelect={() => logout.mutate()}
              >
                <LogOut size={14} /> {t('nav.signOut')}
              </DropdownMenu.Item>
              <p className="px-4 pt-1.5 pb-0.5 text-[10px] text-gray-300 dark:text-slate-600 select-none">v1.0.0</p>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      {/* ── Mobile nav drawer (slides below header) ─────────────────────────── */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 top-16 bg-gray-900/40 z-30 lg:hidden"
            onClick={toggleMobileNav}
          />
          <div className="absolute top-16 inset-x-0 z-40 lg:hidden bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="p-3 space-y-0.5">
              <div className="md:hidden px-1 pb-2 mb-1 border-b border-gray-100 dark:border-slate-700">
                <WorkspaceSwitcher />
              </div>
              <MobileNavItem to="/app/dashboard" icon={LayoutDashboard} onNavigate={toggleMobileNav}>{t('nav.dashboard')}</MobileNavItem>
              <MobileNavItem to="/app/my-space" icon={Lock} onNavigate={toggleMobileNav}>My Space</MobileNavItem>
              <MobileNavItem to="/app/analytics" icon={BarChart3} onNavigate={toggleMobileNav}>Analytics</MobileNavItem>
              <MobileNavItem to="/app/notifications" icon={Bell} badge={unreadCount} onNavigate={toggleMobileNav}>{t('nav.notifications')}</MobileNavItem>

              <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                {t('nav.projects')}
              </p>
              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { goToProject(p.id); toggleMobileNav(); }}
                  className={cn(
                    'flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors text-left',
                    currentPath.includes(`/projects/${p.id}`)
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  )}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="truncate flex-1">{p.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500 tabular-nums">{p.task_count || 0}</span>
                </button>
              ))}
              {canCreateProject && (
                <button
                  onClick={() => { setShowCreateProject(true); toggleMobileNav(); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                >
                  <Plus size={15} /> {t('nav.newProject')}
                </button>
              )}

              {isAdminOrAbove(user?.role) && (
                <>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                    {t('nav.admin')}
                  </p>
                  <MobileNavItem to="/app/admin/users" icon={Shield} onNavigate={toggleMobileNav}>{t('nav.userManagement')}</MobileNavItem>
                  {isSuperAdmin(user?.role) && (
                    <MobileNavItem to="/app/admin/backups" icon={Database} onNavigate={toggleMobileNav}>{t('nav.backups')}</MobileNavItem>
                  )}
                </>
              )}
            </nav>
          </div>
        </>
      )}

      {showCreateProject && <CreateProjectModal onClose={() => setShowCreateProject(false)} />}
    </>
  );
}

function MobileNavItem({ to, icon: Icon, children, badge, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors w-full"
      activeProps={{ className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' }}
      inactiveProps={{ className: 'text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700' }}
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1">{children}</span>
      {badge > 0 && (
        <span className="bg-coral-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}
