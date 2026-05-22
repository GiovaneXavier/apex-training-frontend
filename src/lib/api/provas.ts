import { api } from '@/lib/api';
import type { Prova, ProvaPrioridade, Modalidade } from '@/types/treino';

export type ListProvasFilters = {
  desde?: string;
  ate?: string;
  prioridade?: ProvaPrioridade;
  incluirArquivadas?: boolean;
  limit?: number;
};

export async function listProvas(
  alunoId: string,
  filters: ListProvasFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<Prova[]> {
  const { data } = await api.get<{ provas: Prova[] }>(`/provas/${alunoId}`, {
    params: filters,
    signal: opts.signal,
  });
  return data.provas;
}

// PR #38 — endpoint dedicado pro countdown do Dashboard. Backend filtra
// pra retornar APENAS a Race A ativa (prioridade=A, arquivada=false).
// Retorno `null` quando não há alvo definido.
export async function getProvaAlvo(
  alunoId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Prova | null> {
  const { data } = await api.get<{ alvo: Prova | null }>(`/provas/${alunoId}/alvo`, {
    signal: opts.signal,
  });
  return data.alvo;
}

export type CriarProvaInput = {
  alunoId?: string;
  modalidade: Modalidade;
  nome: string;
  data: string;
  // PR #37 — campos novos. Backend default: prioridade='C' se omitido.
  // Form do Dashboard manda 'A' (criar prova já como alvo).
  prioridade?: ProvaPrioridade;
  alvoTempo?: string;
  local?: string;
  detalhes?: Record<string, unknown>;
};

export async function criarProva(input: CriarProvaInput): Promise<Prova> {
  const { data } = await api.post<{ prova: Prova }>('/provas', input);
  return data.prova;
}

// PR #38 — erro estruturado do backend ao tentar criar/promover uma
// segunda Race A. Frontend interpreta pra mostrar "Você já tem o
// alvo X — quer trocar?" sem precisar de query extra.
export type ProvaConflictError = {
  code: 'PROVA_ALVO_DUPLICADO';
  alvoAtual: { id: string; nome: string; data: string } | null;
  message: string;
};

export type AtualizarProvaInput = {
  modalidade?: Modalidade;
  nome?: string;
  data?: string;
  prioridade?: ProvaPrioridade;
  arquivada?: boolean;
  alvoTempo?: string | null;
  local?: string | null;
  detalhes?: Record<string, unknown>;
};

export async function atualizarProva(provaId: string, patch: AtualizarProvaInput): Promise<Prova> {
  const { data } = await api.patch<{ prova: Prova }>(`/provas/${provaId}`, patch);
  return data.prova;
}

export async function promoverProva(provaId: string, prioridade: ProvaPrioridade): Promise<Prova> {
  const { data } = await api.post<{ prova: Prova }>(`/provas/${provaId}/promover`, { prioridade });
  return data.prova;
}

export async function arquivarProva(provaId: string): Promise<Prova> {
  const { data } = await api.post<{ prova: Prova }>(`/provas/${provaId}/arquivar`, {});
  return data.prova;
}

export async function deleteProva(provaId: string): Promise<void> {
  await api.delete(`/provas/${provaId}`);
}
