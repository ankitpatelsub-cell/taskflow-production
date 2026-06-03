import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setToken: (token) => set({ accessToken: token }),

      login: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),

      logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
    }),
    {
      name: 'tf-auth',
      // Persist token + identity; stale tokens refresh via httpOnly cookie on first 401
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
