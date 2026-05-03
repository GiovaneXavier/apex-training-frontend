import { api } from '@/lib/api';
import type { Prova, Modalidade } from '@/types/treino';

export type ListProvasFilters = {
  desde?: string;
  ate?: string;
  limit?: number;
};

export async function listProvas(alunoId: string, filters: ListProvasFilters = {}): Promise<Prova[]> {
  const { data } = await api.get<{ provas: Prova[] }>(`/provas/${alunoId}`, { params: filters });
  return data.provas;
}

export type CriarProvaInput = {
  alunoId?: string;
  modalidade: Modalidade;
  nome: string;
  data: string;
  detalhes?: Record<string, unknown>;
};

export async function criarProva(input: CriarProvaInput): Promise<Prova> {
  const { data } = await api.post<{ prova: Prova }>('/provas', input);
  return data.prova;
}

export async function deleteProva(provaId: string): Promise<void> {
  await api.delete(`/provas/${provaId}`);
}
