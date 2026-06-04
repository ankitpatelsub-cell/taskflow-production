import { Menu, Sun, Moon, Monitor, Search } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { useLogout } from '@/hooks/useAuth';
import { useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const { user } = useAuthStore();
  const { theme, cycleTheme } = useThemeStore();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center px-4 gap-2 shrink-0 shadow-sm">
      <button
        onClick={toggleSidebar}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Search hint — clicks open command palette */}
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
      >
        <Search size={13} />
        <span className="text-xs">Search…</span>
        <kbd className="text-[10px] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5 font-mono leading-none">⌘K</kbd>
      </button>

      <div className="flex-1" />

      {/* Theme cycle: system → light → dark → system */}
      <button
        onClick={cycleTheme}
        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        title={theme === 'dark' ? 'Theme: Dark' : theme === 'light' ? 'Theme: Light' : 'Theme: System (auto)'}
      >
        {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
      </button>

      <NotificationBell />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none">
            <Avatar name={user?.name} src={user?.avatar_url} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 dark:text-slate-100 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-400 dark:text-slate-500 capitalize leading-tight">{user?.role}</p>
            </div>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-xl py-1.5 min-w-44 z-50"
            align="end" sideOffset={8}
          >
            <div className="px-3 py-2 border-b border-gray-50 dark:border-slate-700 mb-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <DropdownMenu.Item
              className="flex items-center px-3 py-1.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer focus:outline-none rounded-lg mx-1"
              onSelect={() => navigate({ to: '/app/profile' })}
            >
              My Profile
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="border-t border-gray-50 dark:border-slate-700 my-1" />
            <DropdownMenu.Item
              className="flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer focus:outline-none rounded-lg mx-1"
              onSelect={() => logout.mutate()}
            >
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
