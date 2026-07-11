import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student' | 'instructor';
}

interface AuthState {
  user: AuthUser | null;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
}

// Security: only persist non-secret user info. Tokens live in memory
// (access) and httpOnly cookies (refresh), never localStorage.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setAuth: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user });
      },
      clearAuth: () => {
        setAccessToken(null);
        set({ user: null });
      },
    }),
    {
      name: 'auth-user',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);