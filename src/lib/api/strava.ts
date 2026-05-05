import { api } from '@/lib/api';

export type AtividadeStrava = {
  id: string;
  alunoId: string;
  stravaId: string;
  tipo: string;
  nome: string;
  distanciaM: number;
  duracaoSeg: number;
  ritmoMedio?: number | null;
  fcMedia?: number | null;
  iniciadoEm: string;
  sincronizadoEm: string;
};

export type StravaStatus = {
  connected: boolean;
  stravaUserId: string | null;
  expiraEm: string | null;
};

export type SyncResult = {
  novas: number;
  total: number;
  sincronizadoEm: string;
};

export async function getStravaStatus(): Promise<StravaStatus> {
  const { data } = await api.get<StravaStatus>('/strava/status');
  return data;
}

export async function connectStrava(code: string): Promise<StravaStatus> {
  const { data } = await api.post<StravaStatus>('/strava/connect', { code });
  return data;
}

export async function disconnectStrava(): Promise<void> {
  await api.post('/strava/disconnect');
}

export async function syncStrava(): Promise<SyncResult> {
  const { data } = await api.post<SyncResult>('/strava/sync');
  return data;
}

export async function listAtividadesStrava(alunoId: string, limit = 20): Promise<AtividadeStrava[]> {
  const { data } = await api.get<{ atividades: AtividadeStrava[] }>(`/strava/atividades/${alunoId}`, { params: { limit } });
  return data.atividades;
}

// ── URL builder ────────────────────────────────────────────────
export function buildStravaAuthUrl(): string {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_STRAVA_CLIENT_ID não configurado no .env');
  }
  const redirectUri = `${window.location.origin}/strava/callback`;
  const scope = 'read,activity:read';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}
