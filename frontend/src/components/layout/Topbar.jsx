import { Menu } from 'lucide-react';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { NotificationBell } from '@/components/shared/NotificationBell';
import { useLogout } from '@/hooks/useAuth';
import { useNavigate } from '@tanstack/react-router';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

export function Topbar({ title }) {
  const { toggleSidebar } = useUiStore();
  const { user } = useAuthStore();
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="h-14 border-b border-gray-100 bg-white flex items-center px-4 gap-3 shrink-0 shadow-sm">
      <button
        onClick={toggleSidebar}
        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        title="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="flex-1" />

      <NotificationBell />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none group">
            <Avatar name={user?.name} src={user?.avatar_url} size="sm" />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize leading-tight">{user?.role}</p>
            </div>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-44 z-50"
            align="end"
            sideOffset={8}
          >
            <div className="px-3 py-2 border-b border-gray-50 mb-1">
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <DropdownMenu.Item
              className="flex items-center px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer focus:outline-none rounded-lg mx-1"
              onSelect={() => navigate({ to: '/app/profile' })}
            >
              My Profile
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="border-t border-gray-50 my-1" />
            <DropdownMenu.Item
              className="flex items-center px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 cursor-pointer focus:outline-none rounded-lg mx-1"
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
