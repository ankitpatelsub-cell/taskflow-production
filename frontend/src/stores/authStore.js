import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setToken: (token) => set({ accessToken: token }),

  login: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),

  logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),

  updateUser: (updates) =>
    set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
}));
