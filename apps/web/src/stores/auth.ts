import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; displayName: string } | null;
  workspaceId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('phork_token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('phork_user') || 'null') : null,
  workspaceId: typeof window !== 'undefined' ? localStorage.getItem('phork_workspace') : null,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('phork_token', res.token);
    localStorage.setItem('phork_user', JSON.stringify(res.user));
    if (res.workspaces?.length > 0) {
      localStorage.setItem('phork_workspace', res.workspaces[0].workspaceId);
    }
    set({
      token: res.token,
      user: res.user,
      workspaceId: res.workspaces?.[0]?.workspaceId || null,
    });
  },

  register: async (email, password, displayName) => {
    const res = await api.post('/auth/register', { email, password, displayName });
    localStorage.setItem('phork_token', res.token);
    localStorage.setItem('phork_user', JSON.stringify(res.user));
    localStorage.setItem('phork_workspace', res.workspace.id);
    set({
      token: res.token,
      user: res.user,
      workspaceId: res.workspace.id,
    });
  },

  logout: () => {
    localStorage.removeItem('phork_token');
    localStorage.removeItem('phork_user');
    localStorage.removeItem('phork_workspace');
    set({ token: null, user: null, workspaceId: null });
  },

  hydrate: () => {
    const token = localStorage.getItem('phork_token');
    const user = JSON.parse(localStorage.getItem('phork_user') || 'null');
    const workspaceId = localStorage.getItem('phork_workspace');
    set({ token, user, workspaceId });
  },
}));
