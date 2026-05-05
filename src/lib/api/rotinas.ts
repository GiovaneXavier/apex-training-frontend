import { api } from '@/lib/api';
import type { Exercicio } from './exercicios';
import type { Treino } from '@/types/treino';

export type DiaSemana = 'DOM' | 'SEG' | 'TER' | 'QUA' | 'QUI' | 'SEX' | 'SAB';

export const DIA_SEMANA_LABEL: Record<DiaSemana, string> = {
  DOM: 'Domingo',
  SEG: 'Segunda',
  TER: 'Terça',
  QUA: 'Quarta',
  QUI: 'Quinta',
  SEX: 'Sexta',
  SAB: 'Sábado',
};

export const DIA_SEMANA_SHORT: Record<DiaSemana, string> = {
  DOM: 'DOM', SEG: 'SEG', TER: 'TER', QUA: 'QUA', QUI: 'QUI', SEX: 'SEX', SAB: 'SAB',
};

export const DIAS: DiaSemana[] = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

export type RotinaExercicio = {
  id: string;
  rotinaId: string;
  exercicioId: string;
  ordem: number;
  series: number;
  reps: number | null;
  repsMin: number | null;
  repsMax: number | null;
  cargaPctRP: number | null;
  cargaKg: number | null;
  descansoSeg: number | null;
  observacao: string | null;
  exercicio: Exercicio;
};

export type Rotina = {
  id: string;
  alunoId: string;
  professorId: string;
  nome: string;
  diaSemana: DiaSemana;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: string;
  atualizadoEm: string;
  exercicios: RotinaExercicio[];
};

export type RotinaInputExercicio = {
  exercicioId: string;
  ordem: number;
  series: number;
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  cargaPctRP?: number;
  cargaKg?: number;
  descansoSeg?: number;
  observacao?: string;
};

export type RotinaCreateInput = {
  alunoId: string;
  nome: string;
  diaSemana: DiaSemana;
  vigenciaInicio: string;
  vigenciaFim?: string | null;
  exercicios: RotinaInputExercicio[];
};

export async function listRotinas(filters: { alunoId?: string; diaSemana?: DiaSemana; ativasEm?: string } = {}): Promise<Rotina[]> {
  const { data } = await api.get<Rotina[]>('/rotinas', { params: filters });
  return data;
}

export async function getRotina(id: string): Promise<Rotina> {
  const { data } = await api.get<Rotina>(`/rotinas/${id}`);
  return data;
}

export async function rotinasDoDia(alunoId: string, dataRef?: string): Promise<Rotina[]> {
  const { data } = await api.get<Rotina[]>(`/rotinas/aluno/${alunoId}/dia`, {
    params: dataRef ? { data: dataRef } : undefined,
  });
  return data;
}

export async function createRotina(input: RotinaCreateInput): Promise<Rotina> {
  const { data } = await api.post<Rotina>('/rotinas', input);
  return data;
}

export async function updateRotina(id: string, input: Partial<RotinaCreateInput>): Promise<Rotina> {
  const { data } = await api.put<Rotina>(`/rotinas/${id}`, input);
  return data;
}

export async function deleteRotina(id: string): Promise<void> {
  await api.delete(`/rotinas/${id}`);
}

export async function iniciarTreinoDeRotina(rotinaId: string, dataAlvo?: string): Promise<Treino> {
  const { data } = await api.post<Treino>(`/rotinas/${rotinaId}/iniciar`, dataAlvo ? { dataAlvo } : {});
  return data;
}

export async function reagendarTreino(treinoId: string, novaDataAlvo: string): Promise<Treino> {
  const { data } = await api.patch<Treino>(`/rotinas/treinos/${treinoId}/reagendar`, { novaDataAlvo });
  return data;
}
