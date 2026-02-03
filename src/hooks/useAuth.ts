import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Player } from '@/lib/chess/types';
import { apiJson } from '@/lib/api';

interface AuthState {
  user: Player | null;
  token: string | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

function apiUserToPlayer(u: { id: string; username: string; displayName?: string; avatar?: string | null; walletBalance: number; gamesPlayed: number; gamesWon: number; gamesLost: number; gamesDraw: number; totalEarnings?: number; isBanned: boolean; isFrozen: boolean; createdAt: string }): Player {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName ?? u.username,
    avatar: u.avatar ?? undefined,
    walletBalance: u.walletBalance,
    gamesPlayed: u.gamesPlayed,
    gamesWon: u.gamesWon,
    gamesLost: u.gamesLost,
    gamesDraw: u.gamesDraw,
    totalEarnings: u.totalEarnings ?? 0,
    isBanned: u.isBanned,
    isFrozen: u.isFrozen,
    createdAt: new Date(u.createdAt),
  };
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAdmin: false,

      login: async (username: string, password: string) => {
        try {
          const data = await apiJson<{ user: unknown; token: string; isAdmin: boolean }>('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const user = apiUserToPlayer(data.user as Parameters<typeof apiUserToPlayer>[0]);
          set({ user, token: data.token, isAdmin: data.isAdmin });
          return true;
        } catch {
          return false;
        }
      },

      register: async (username: string, password: string) => {
        try {
          const data = await apiJson<{ user: unknown; token: string; isAdmin: boolean }>('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const user = apiUserToPlayer(data.user as Parameters<typeof apiUserToPlayer>[0]);
          set({ user, token: data.token, isAdmin: data.isAdmin });
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAdmin: false });
      },

      refreshUser: async () => {
        const token = get().token;
        if (!token) return;
        try {
          const data = await apiJson<{ user: unknown; isAdmin: boolean }>('/api/auth/me', { token });
          const user = apiUserToPlayer(data.user as Parameters<typeof apiUserToPlayer>[0]);
          set({ user, isAdmin: data.isAdmin });
        } catch {
          set({ user: null, token: null, isAdmin: false });
        }
      },
    }),
    {
      name: 'chess-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAdmin: s.isAdmin }),
    }
  )
);
