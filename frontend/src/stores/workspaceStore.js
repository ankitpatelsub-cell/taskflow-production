import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useWorkspaceStore = create(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      workspaces: [],

      setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
      setWorkspaces: (list) => set({ workspaces: list }),

      addWorkspace: (ws) =>
        set((s) => ({ workspaces: [...s.workspaces, ws] })),

      updateWorkspace: (id, updates) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w)),
        })),

      clear: () => set({ currentWorkspaceId: null, workspaces: [] }),
    }),
    {
      name: 'tf-workspace',
      partialize: (s) => ({ currentWorkspaceId: s.currentWorkspaceId }),
    }
  )
);
