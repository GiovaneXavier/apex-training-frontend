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

export async function connectStrava(code: string, state: string): Promise<StravaStatus> {
  // `state` é validado client-side em StravaCallback antes desta chamada;
  // o backend também valida formato como defesa em camadas.
  const { data } = await api.post<StravaStatus>('/strava/connect', { code, state });
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

// ── OAuth state — defesa contra Account Linking Hijacking ───────
//
// Ataque que prevenimos:
//   Atacante engana vítima a abrir URL de callback do Strava com o `code`
//   gerado pelo APP DELE. Sem state, app conecta o Strava do atacante
//   à conta da vítima → atacante vê dados privados do app, ou injeta
//   atividades fraudulentas.
//
// Defesa:
//   1. Antes de redirecionar pro Strava, geramos um `state` random e
//      gravamos em sessionStorage (origem-scoped, attacker JS não escreve).
//   2. Strava ecoa o state no redirect de volta.
//   3. StravaCallback compara: URL.state === sessionStorage.state.
//      Match → segue. Mismatch → aborta e mostra erro.
//
// Por que sessionStorage e não cookie:
//   - Cookie cross-origin (api.onrender.com ↔ app.vercel.app) complica.
//   - sessionStorage é origin-strict, sobrevive ao redirect (mesma aba),
//     e some no fim da sessão — perfeito pra one-shot OAuth.

const STATE_STORAGE_KEY = 'apex.strava.oauth-state';

function generateState(): string {
  // 32 bytes de entropia → ~43 chars base64url. crypto.getRandomValues
  // é CSPRNG padrão do browser; Math.random NÃO serve aqui.
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  // base64url encoding (sem +/=, URL-safe).
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function buildStravaAuthUrl(): string {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error('VITE_STRAVA_CLIENT_ID não configurado no .env');
  }
  const state = generateState();
  // Grava ANTES do redirect — se algo falhar aqui o usuário não sai da app.
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const redirectUri = `${window.location.origin}/strava/callback`;
  const scope = 'read,activity:read';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope,
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params.toString()}`;
}

/**
 * Lê o state esperado (gravado antes do redirect) e APAGA da sessionStorage
 * — token one-shot. Chamadas subsequentes retornam null.
 */
export function consumeStravaState(): string | null {
  const stored = sessionStorage.getItem(STATE_STORAGE_KEY);
  if (stored) sessionStorage.removeItem(STATE_STORAGE_KEY);
  return stored;
}

/**
 * Compara em tempo constante o state do Strava com o esperado.
 * Tempo constante mitiga side-channel; aqui é low-stakes mas custa nada.
 */
export function verifyStravaState(received: string, expected: string): boolean {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
