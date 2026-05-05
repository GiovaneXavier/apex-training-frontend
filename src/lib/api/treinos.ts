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

export async function listTreinos(alunoId: string, filters: ListTreinosFilters = {}): Promise<Treino[]> {
  const { data } = await api.get<{ treinos: Treino[] }>(`/treinos/${alunoId}`, { params: filters });
  return data.treinos;
}

export async function getTreino(treinoId: string): Promise<Treino> {
  const { data } = await api.get<{ treino: Treino }>(`/treinos/detalhe/${treinoId}`);
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

export type HistoricoCarga = {
  kg: number | null;
  reps: number | null;
  dataAlvo: string;
  treinoId: string;
};

// Mapa { nomeNormalizado(lowercase) -> última execução do aluno }
export async function getHistoricoCargas(nomes: string[]): Promise<Record<string, HistoricoCarga>> {
  if (nomes.length === 0) return {};
  const { data } = await api.get<Record<string, HistoricoCarga>>('/treinos/historico-cargas', {
    params: { nomes: nomes.join(',') },
  });
  return data;
}
