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

export async function getStreak(): Promise<StreakResponse> {
  const { data } = await api.get<StreakResponse>('/aluno/streak');
  return data;
}

export async function listConquistas(): Promise<ConquistasResponse> {
  const { data } = await api.get<ConquistasResponse>('/aluno/conquistas');
  return data;
}
