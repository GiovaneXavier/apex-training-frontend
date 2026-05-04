import { api } from '@/lib/api';
import type { SetRealizado, Treino } from '@/types/treino';

export type NovoRecorde = {
  id: string;
  exercicio: string;
  valor: number;
  unidade: string;
  reps: number | null;
  dataRecorde: string;
  anterior: { valor: number; dataRecorde: string } | null;
};

export type SalvarPayload = {
  exercicios?: Array<{ nome: string; realizado: SetRealizado[] }>;
  realizado?: Record<string, unknown>;
  status?: 'CONCLUIDO' | 'PULADO';
  finalizadoEm?: string;
};

export type SalvarResponse = {
  treino: Treino;
  novosRecordes: NovoRecorde[];
};

export async function salvarExecucao(treinoId: string, payload: SalvarPayload): Promise<SalvarResponse> {
  const { data } = await api.post<SalvarResponse>(`/treinos/${treinoId}/salvar`, payload);
  return data;
}
