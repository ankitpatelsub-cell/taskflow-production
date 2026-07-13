import { create } from 'zustand';

export const useUiStore = create((set) => ({
  // Drives the mobile nav drawer in TopNav (the desktop nav is always visible)
  sidebarOpen: false,
  activeProjectId: null,
  taskDrawerOpen: false,
  selectedTaskId: null,
  quickCreateOpen: false,
  contactOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveProject: (id) => set({ activeProjectId: id }),
  openTaskDrawer: (taskId) => set({ taskDrawerOpen: true, selectedTaskId: taskId }),
  closeTaskDrawer: () => set({ taskDrawerOpen: false, selectedTaskId: null }),
  openQuickCreate: () => set({ quickCreateOpen: true }),
  closeQuickCreate: () => set({ quickCreateOpen: false }),
  openContact:  () => set({ contactOpen: true }),
  closeContact: () => set({ contactOpen: false }),
}));
