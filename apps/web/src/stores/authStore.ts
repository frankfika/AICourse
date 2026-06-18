import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'student' | 'instructor';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create(
  persist<AuthState>(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null });
      },
    }),
    { name: 'auth-storage' },
  ),
);
