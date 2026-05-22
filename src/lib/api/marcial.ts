import { api } from '@/lib/api';

// PR #24 — Jornada do Faixa Preta (BJJ).

export type Faixa =
  | 'BRANCA' | 'AZUL' | 'ROXA' | 'MARROM' | 'PRETA' | 'CORAL' | 'VERMELHA';

export const FAIXA_LABEL: Record<Faixa, string> = {
  BRANCA: 'Branca',
  AZUL: 'Azul',
  ROXA: 'Roxa',
  MARROM: 'Marrom',
  PRETA: 'Preta',
  CORAL: 'Coral',
  VERMELHA: 'Vermelha',
};

// Cores hex das faixas (espelha tatame real).
export const FAIXA_COR: Record<Faixa, string> = {
  BRANCA: '#f4f4f5',
  AZUL: '#1e40af',
  ROXA: '#6b21a8',
  MARROM: '#5b2a06',
  PRETA: '#0a0a0b',
  CORAL: '#fc4c02',
  VERMELHA: '#b91c1c',
};

export type Promocao = {
  id: string;
  alunoId: string;
  faixa: Faixa;
  grauNum: number;
  dataPromocao: string;
  instrutorNome: string | null;
  observacao: string | null;
  criadoEm: string;
};

export type PromocaoInput = {
  alunoId?: string;
  faixa: Faixa;
  grauNum?: number;
  dataPromocao: string;
  instrutorNome?: string;
  observacao?: string;
};

export type Jornada = {
  faixaAtual: Promocao | null;
  matTimeNaFaixaSeg: number;
  proximaFaixa: Faixa | null;
  metaSegundos: number | null;
  progressoPct: number;
};

export async function getJornadaMarcial(
  alunoId?: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Jornada> {
  const path = alunoId ? `/marcial/aluno/${alunoId}/jornada` : '/marcial/jornada';
  const { data } = await api.get<Jornada>(path, { signal: opts.signal });
  return data;
}

export async function listPromocoes(
  filters: { alunoId?: string; limit?: number } = {},
  opts: { signal?: AbortSignal } = {},
): Promise<Promocao[]> {
  const { data } = await api.get<{ promocoes: Promocao[] }>('/marcial', {
    params: filters,
    signal: opts.signal,
  });
  return data.promocoes;
}

export async function registrarPromocao(input: PromocaoInput): Promise<Promocao> {
  const { data } = await api.post<{ promocao: Promocao }>('/marcial', input);
  return data.promocao;
}

export async function deletePromocao(id: string): Promise<void> {
  await api.delete(`/marcial/${id}`);
}
