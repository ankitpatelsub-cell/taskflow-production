import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useUiStore } from '@/stores/uiStore';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Global keyboard shortcuts:
 *   D  → Dashboard
 *   P  → Projects list
 *   N  → Notifications
 *   B  → Board view (if in a project)
 *   L  → List view (if in a project)
 *   S  → Standup view (if in a project)
 *   T  → Toggle theme (dark/light)
 *   \  → Toggle sidebar
 *   Esc → Close task drawer
 */
export function useKeyboardShortcuts() {
  const navigate   = useNavigate();
  const { toggleSidebar, closeTaskDrawer, taskDrawerOpen, activeProjectId } = useUiStore();
  const { toggleTheme } = useThemeStore();

  useEffect(() => {
    function handler(e) {
      // Skip if user is typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'd': navigate({ to: '/app/dashboard' }); break;
        case 'n': navigate({ to: '/app/notifications' }); break;
        case 'b':
          if (activeProjectId) navigate({ to: `/app/projects/${activeProjectId}/board` });
          break;
        case 'l':
          if (activeProjectId) navigate({ to: `/app/projects/${activeProjectId}/list` });
          break;
        case 's':
          if (activeProjectId) navigate({ to: `/app/projects/${activeProjectId}/standup` });
          break;
        case 't': toggleTheme(); break;
        case '\\': toggleSidebar(); break;
        case 'Escape':
          if (taskDrawerOpen) closeTaskDrawer();
          break;
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeProjectId, taskDrawerOpen]);
}
