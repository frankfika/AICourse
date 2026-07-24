import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAccessToken } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  // 与 backend prisma UserRole enum 严格对齐(admin/student/instructor)
  // 注: 之前含 'super_admin' 字段,但 prisma schema 没这个 enum 值, 是 dead code.
  // 2026-07-23 安全加固时统一删除。如以后真要加 super_admin 角色, 同步
  // 改 prisma schema + backend + 这里。
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