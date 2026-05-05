import axios, { AxiosError } from 'axios';

export const TOKEN_KEY = 'apex.token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ error?: string; message?: string }>) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // Permite que AuthContext trate redirect via state listener
      window.dispatchEvent(new CustomEvent('apex:logout'));
    }
    return Promise.reject(err);
  },
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string; issues?: { message: string }[] } | undefined;
    if (data?.issues?.length) return data.issues.map((i) => i.message).join(' · ');
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  return 'Erro inesperado';
}
