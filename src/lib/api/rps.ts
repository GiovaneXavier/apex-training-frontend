import { api } from '@/lib/api';
import type { Modalidade } from '@/types/treino';

export type RecordePessoal = {
  id: string;
  alunoId: string;
  modalidade: Modalidade;
  exercicio: string;
  metrica: string;
  valor: number;
  unidade: string;
  reps: number | null;
  dataRecorde: string;
  treinoId: string | null;
};

export type RPGroup = {
  exercicio: string;
  modalidade: Modalidade;
  top: RecordePessoal;
  porReps: RecordePessoal[];
  historico: RecordePessoal[];
};

export type ListRPsResponse = {
  records: RecordePessoal[];
  grouped: RPGroup[];
};

export type ListRPsFilters = {
  exercicio?: string;
  modalidade?: Modalidade;
  limit?: number;
};

export async function listRPs(
  alunoId: string,
  filters: ListRPsFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<ListRPsResponse> {
  const { data } = await api.get<ListRPsResponse>(`/rps/${alunoId}`, {
    params: filters,
    signal: opts.signal,
  });
  return data;
}
