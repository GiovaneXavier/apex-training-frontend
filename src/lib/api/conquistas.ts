import { api } from '@/lib/api';

// PR #31 — cliente de gamificação (Sprint 11).

export type Tier = 'bronze' | 'prata' | 'ouro' | 'platina';

export type StreakResponse = {
  atual: number;
  maximoHistorico: number;
  semanasUltimas12: Array<{
    semana: string;       // ISO date (segunda da semana)
    valida: boolean;
    atividades: number;
  }>;
};

export type ConquistaItem = {
  codigo: string;
  titulo: string;
  descricao: string;
  hintLocked: string;
  tier: Tier;
  icone: string;
  desbloqueada: boolean;
  desbloqueadoEm: string | null;
};

export type ConquistasResponse = {
  itens: ConquistaItem[];
  totalDesbloqueadas: number;
  totalCatalogo: number;
};

export async function getStreak(
  opts: { signal?: AbortSignal } = {},
): Promise<StreakResponse> {
  const { data } = await api.get<StreakResponse>('/aluno/streak', { signal: opts.signal });
  return data;
}

export async function listConquistas(
  opts: { signal?: AbortSignal } = {},
): Promise<ConquistasResponse> {
  const { data } = await api.get<ConquistasResponse>('/aluno/conquistas', { signal: opts.signal });
  return data;
}
