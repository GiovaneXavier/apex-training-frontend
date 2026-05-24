import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, setCsrfToken } from '@/lib/api';

// ADMIN incluído após bug de login em produção: backend já emitia
// `role: 'ADMIN'` (seed-admin), mas o tipo do front não cobria → switch
// em dashboardPathFor caía sem retornar e `navigate(undefined)` travava
// a tela após o POST /auth/login 200.
export type Role = 'ALUNO' | 'PROFESSOR' | 'NUTRICIONISTA' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  role: Role;
  // `ativo` faz parte do payload do backend (User.ativo). Marcado opcional
  // porque rotas legadas e o /auth/me podem não incluir em todas as versões.
  ativo?: boolean;
  avatarUrl?: string | null;
  aluno?: { id: string; stravaConnected?: boolean } | null;
  professor?: { id: string } | null;
  nutricionista?: { id: string } | null;
};

type AuthCtx = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  logout: () => Promise<void>;
};

export type RegisterInput = {
  nome: string;
  email: string;
  senha: string;
  role: Role;
  crn?: string;
  bio?: string;
};

// PROFESSOR/NUTRICIONISTA caem aqui após registro: backend devolve 202
// e a conta fica pendente. UI deve mostrar a mensagem e NÃO navegar
// para o dashboard.
export type RegisterResult =
  | { kind: 'logged-in'; user: AuthUser }
  | { kind: 'pending'; message: string };

const Ctx = createContext<AuthCtx | null>(null);

// USER_KEY guarda só o perfil enxuto pra hidratação ótica antes de
// /auth/me retornar. NUNCA contém token nem CSRF.
const USER_KEY = 'apex.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Tenta hidratar via /auth/me. Se o cookie HttpOnly existir e for
  // válido, server devolve user+csrf. Caso contrário, 401 → limpa state.
  useEffect(() => {
    let cancelled = false;
    api.get<{ user: AuthUser; csrf: string }>('/auth/me')
      .then((res) => {
        if (cancelled) return;
        setUser(res.data.user);
        setCsrfToken(res.data.csrf);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      })
      .catch(() => {
        if (cancelled) return;
        setCsrfToken(null);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  // 401 disparado por qualquer chamada → limpa state local. Cookie já
  // foi invalidado pelo server (ou expirou).
  useEffect(() => {
    const onLogout = () => {
      setCsrfToken(null);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    };
    window.addEventListener('apex:logout', onLogout);
    return () => window.removeEventListener('apex:logout', onLogout);
  }, []);

  const login = useCallback<AuthCtx['login']>(async (email, senha) => {
    const { data } = await api.post<{ user: AuthUser; csrf: string }>(
      '/auth/login', { email, senha },
    );
    // Cookie HttpOnly foi setado pelo server. CSRF vive só em memória.
    setCsrfToken(data.csrf);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback<AuthCtx['register']>(async (input) => {
    const { data, status } = await api.post<
      | { user: AuthUser; csrf: string }
      | { pending: true; message: string }
    >('/auth/register', input);

    // 202 Accepted: profissional pendente. Não emite cookie, não loga.
    if (status === 202 && 'pending' in data) {
      return { kind: 'pending', message: data.message };
    }

    // 201 Created: ALUNO logado.
    if ('user' in data) {
      setCsrfToken(data.csrf);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return { kind: 'logged-in', user: data.user };
    }

    throw new Error('Resposta de registro em formato inesperado');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server pode estar offline — limpa state local mesmo assim.
    }
    setCsrfToken(null);
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
    case 'ADMIN': return '/admin/cockpit';
    case 'PROFESSOR': return '/professor/dashboard';
    case 'NUTRICIONISTA': return '/nutri/dashboard';
    case 'ALUNO':
    default:
      // Default cobre ALUNO + qualquer role inesperada que o backend
      // venha a emitir no futuro — evita repetir o bug do `undefined`.
      return '/aluno/dashboard';
  }
}
