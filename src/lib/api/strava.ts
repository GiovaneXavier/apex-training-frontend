import { api } from '@/lib/api';
import type { Modalidade, StatusTreino } from '@/types/treino';

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

export async function getStravaStatus(opts: { signal?: AbortSignal } = {}): Promise<StravaStatus> {
  const { data } = await api.get<StravaStatus>('/strava/status', { signal: opts.signal });
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

// ── PR #41b — Sugestões Tier 2 + #41c UI ────────────────────────
//
// Tier 2 = backend retém matches 0.65 ≤ score < 0.92 como StravaSugestao
// PENDENTE aguardando opt-in do aluno. Dashboard lista e oferece [Sim]/[Não].

// Espelha o backend listarSugestoesPendentes (stravaMatch.service.js) —
// include traz subconjunto do Treino e AtividadeStrava para o render do card.
export type StravaSugestaoTreino = {
  id: string;
  titulo: string;
  modalidade: Modalidade;
  dataAlvo: string;
  status: StatusTreino;
};

export type StravaSugestaoAtividade = {
  id: string;
  stravaId: string;
  tipo: string;
  nome: string;
  distanciaM: number;
  duracaoSeg: number;
  iniciadoEm: string;
};

export type StravaSugestao = {
  id: string;
  alunoId: string;
  treinoId: string;
  atividadeStravaId: string;
  score: number;
  scoreBreakdown: Record<string, unknown>;
  status: 'PENDENTE' | 'ACEITA' | 'REJEITADA' | 'EXPIRADA';
  criadaEm: string;
  resolvidaEm: string | null;
  treino: StravaSugestaoTreino;
  atividade: StravaSugestaoAtividade;
};

export async function listSugestoesStrava(opts: { signal?: AbortSignal } = {}): Promise<StravaSugestao[]> {
  const { data } = await api.get<{ sugestoes: StravaSugestao[] }>('/strava/sugestoes', { signal: opts.signal });
  return data.sugestoes;
}

export async function aceitarSugestaoStrava(id: string): Promise<{ ok: true; treinoId: string; sugestaoId: string }> {
  const { data } = await api.post<{ ok: true; treinoId: string; sugestaoId: string }>(`/strava/sugestoes/${id}/aceitar`);
  return data;
}

export async function rejeitarSugestaoStrava(id: string): Promise<{ ok: true; sugestaoId: string }> {
  const { data } = await api.post<{ ok: true; sugestaoId: string }>(`/strava/sugestoes/${id}/rejeitar`);
  return data;
}

// Desfazer Tier 1 — undo de auto-match. Backend zera o vínculo no Treino
// + grava MatchRejeitado motivo='undone_tier1' (impede re-match imediato).
export async function desfazerMatchStrava(treinoId: string): Promise<{ ok: true; treinoId: string }> {
  const { data } = await api.post<{ ok: true; treinoId: string }>(`/strava/treinos/${treinoId}/desfazer-strava`);
  return data;
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
