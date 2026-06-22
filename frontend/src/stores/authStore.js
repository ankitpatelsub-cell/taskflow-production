import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function parseEmailVerified(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return !!payload.email_verified;
  } catch {
    return false;
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      emailVerified: false,

      setToken: (token) => set({ accessToken: token, emailVerified: parseEmailVerified(token) }),

      login: (token, user) => set({
        accessToken: token,
        user,
        isAuthenticated: true,
        emailVerified: parseEmailVerified(token),
      }),

      logout: () => set({ accessToken: null, user: null, isAuthenticated: false, emailVerified: false }),

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      setEmailVerified: (verified) => set({ emailVerified: verified }),
    }),
    {
      name: 'tf-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        emailVerified: state.emailVerified,
      }),
    }
  )
);
