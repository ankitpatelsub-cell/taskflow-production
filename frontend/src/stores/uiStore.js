import { create } from 'zustand';

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  activeProjectId: null,
  taskDrawerOpen: false,
  selectedTaskId: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  openTaskDrawer: (taskId) => set({ taskDrawerOpen: true, selectedTaskId: taskId }),
  closeTaskDrawer: () => set({ taskDrawerOpen: false, selectedTaskId: null }),
}));
