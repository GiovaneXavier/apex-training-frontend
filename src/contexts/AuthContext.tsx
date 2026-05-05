import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, TOKEN_KEY } from '@/lib/api';

export type Role = 'ALUNO' | 'PROFESSOR' | 'NUTRICIONISTA';

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  role: Role;
  avatarUrl?: string | null;
  aluno?: { id: string } | null;
  professor?: { id: string } | null;
  nutricionista?: { id: string } | null;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => void;
};

export type RegisterInput = {
  nome: string;
  email: string;
  senha: string;
  role: Role;
  crn?: string;
  bio?: string;
};

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = 'apex.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Refresh do user via /auth/me se houver token armazenado
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }

    let cancelled = false;
    api.get<{ user: AuthUser }>('/auth/me')
      .then((res) => {
        if (cancelled) return;
        setUser(res.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, []);

  // Logout automático em 401 vindo da api
  useEffect(() => {
    const onLogout = () => {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    };
    window.addEventListener('apex:logout', onLogout);
    return () => window.removeEventListener('apex:logout', onLogout);
  }, []);

  const login = useCallback<AuthCtx['login']>(async (email, senha) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, senha });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback<AuthCtx['register']>(async (input) => {
    const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/register', input);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

export function dashboardPathFor(role: Role): string {
  switch (role) {
    case 'ALUNO': return '/aluno/dashboard';
    case 'PROFESSOR': return '/professor/dashboard';
    case 'NUTRICIONISTA': return '/nutri/dashboard';
  }
}
