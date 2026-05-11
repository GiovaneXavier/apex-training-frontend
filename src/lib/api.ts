import axios, { AxiosError } from 'axios';

// PR #5: token JWT migrou para cookie HttpOnly (não-acessível ao JS).
// Não há mais TOKEN_KEY em localStorage. O CSRF token vive em memória
// e é setado por AuthContext após /auth/login e /auth/me.

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api',
  timeout: 15000,
  // Envia/recebe cookies cross-origin (Vercel ↔ Render em prod).
  // Server precisa CORS credentials:true + origin específico (não '*').
  withCredentials: true,
});

// ─── CSRF em memória ─────────────────────────────────────────────
// Singleton no escopo do módulo. Por que não localStorage:
//   - Se for XSS-exfiltrável, perde o ponto. Em memória sobrevive
//     a XSS persistente apenas durante o tab atual.
//   - Reload do PWA → AuthContext chama /auth/me que recupera o csrf.
let csrfToken: string | null = null;

export function setCsrfToken(t: string | null): void {
  csrfToken = t;
}
export function getCsrfToken(): string | null {
  return csrfToken;
}

const MUTATING = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (MUTATING.has(method) && csrfToken && config.headers) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string; message?: string }>) => {
    if (err.response?.status === 401) {
      // Server invalidou (token expirado/cookie limpo). Sinaliza pro
      // AuthContext limpar estado em-memória.
      csrfToken = null;
      window.dispatchEvent(new CustomEvent('apex:logout'));
    }
    return Promise.reject(err);
  },
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; issues?: { message: string }[] }
      | undefined;
    if (data?.issues?.length) return data.issues.map((i) => i.message).join(' · ');
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  // Error nativo (ex.: throw síncrono em buildStravaAuthUrl). Antes
  // caía em 'Erro inesperado' e escondia a causa raiz.
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err) return err;
  return 'Erro inesperado';
}
