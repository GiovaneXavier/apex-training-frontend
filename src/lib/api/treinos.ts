import { api } from '@/lib/api';
import type {
  Treino,
  StatusTreino,
  Modalidade,
  TreinoDetalhes,
} from '@/types/treino';

export type ListTreinosFilters = {
  status?: StatusTreino;
  desde?: string;
  ate?: string;
  limit?: number;
};

// PR #15 (audit 5.17) — `signal` opcional propaga AbortController de
// dentro de um useEffect. Trocar de rota cancela fetches pendentes,
// poupa banda do celular e load do backend.
export async function listTreinos(
  alunoId: string,
  filters: ListTreinosFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<Treino[]> {
  const { data } = await api.get<{ treinos: Treino[] }>(`/treinos/${alunoId}`, {
    params: filters,
    signal: opts.signal,
  });
  return data.treinos;
}

export async function getTreino(
  treinoId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<Treino> {
  const { data } = await api.get<{ treino: Treino }>(`/treinos/detalhe/${treinoId}`, {
    signal: opts.signal,
  });
  return data.treino;
}

export type PrescreverInput = {
  alunoId: string;
  modalidade: Modalidade;
  titulo: string;
  dataAlvo: string;
  detalhes: TreinoDetalhes;
};

export async function prescreverTreino(input: PrescreverInput): Promise<Treino> {
  const { data } = await api.post<{ treino: Treino }>('/treinos/prescrever', input);
  return data.treino;
}

export async function deleteTreino(treinoId: string): Promise<void> {
  await api.delete(`/treinos/${treinoId}`);
}

// PR #16 — clonar treino prescrito (reaproveitamento de carga).
// Backend zera o `realizado` no detalhes e grava como PENDENTE numa
// `dataAlvo` nova. Aceita janela [-90d, +180d].
export async function clonarTreino(treinoId: string, dataAlvo: string): Promise<Treino> {
  const { data } = await api.post<{ treino: Treino }>(`/treinos/${treinoId}/clonar`, { dataAlvo });
  return data.treino;
}

export type HistoricoCarga = {
  kg: number | null;
  reps: number | null;
  dataAlvo: string;
  treinoId: string;
};

// Mapa { nomeNormalizado(lowercase) -> última execução do aluno }
export async function getHistoricoCargas(
  nomes: string[],
  opts: { signal?: AbortSignal } = {},
): Promise<Record<string, HistoricoCarga>> {
  if (nomes.length === 0) return {};
  const { data } = await api.get<Record<string, HistoricoCarga>>('/treinos/historico-cargas', {
    params: { nomes: nomes.join(',') },
    signal: opts.signal,
  });
  return data;
}
