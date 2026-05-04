import { api } from '@/lib/api';
import type { Treino, Prova, Modalidade, StatusTreino } from '@/types/treino';

export type AlunoVinculado = {
  vinculoId: string;
  alunoId: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  desde: string;
  treinosPendentes: number;
};

export type ProfessorDashboard = {
  totalAlunos: number;
  pendentesSemana: number;
  concluidosSemana: number;
  treinosPrescritos: number;
};

export type RecordePessoal = {
  id: string;
  exercicio: string;
  metrica: string;
  valor: number;
  unidade: string;
  reps: number | null;
  modalidade: string;
  dataRecorde: string;
};

export type AlunoDetalhe = {
  aluno: {
    id: string;
    nome: string;
    email: string;
    avatarUrl?: string | null;
    pesoKg?: number | null;
    alturaCm?: number | null;
    dataNascimento?: string | null;
  };
  treinosPendentes: Treino[];
  treinosConcluidos: Treino[];
  proximaProva: Prova | null;
  recordesRecentes: RecordePessoal[];
};

export async function getDashboard(): Promise<ProfessorDashboard> {
  const { data } = await api.get<ProfessorDashboard>('/professor/dashboard');
  return data;
}

export async function listAlunos(): Promise<AlunoVinculado[]> {
  const { data } = await api.get<{ alunos: AlunoVinculado[] }>('/professor/alunos');
  return data.alunos;
}

export async function vincularPorEmail(email: string): Promise<AlunoVinculado> {
  const { data } = await api.post<{ aluno: AlunoVinculado }>('/professor/vincular', { email });
  return data.aluno;
}

export async function desvincular(vinculoId: string): Promise<void> {
  await api.delete(`/professor/vinculo/${vinculoId}`);
}

export async function getAlunoDetalhe(alunoId: string): Promise<AlunoDetalhe> {
  const { data } = await api.get<AlunoDetalhe>(`/professor/aluno/${alunoId}`);
  return data;
}

export type CalendarioTreino = {
  id: string;
  alunoId: string;
  alunoNome: string;
  modalidade: Modalidade;
  titulo: string;
  status: StatusTreino;
  dataAlvo: string;
};

export type CalendarioProva = {
  id: string;
  alunoId: string;
  alunoNome: string;
  modalidade: Modalidade;
  nome: string;
  data: string;
};

export type CalendarioResponse = {
  treinos: CalendarioTreino[];
  provas: CalendarioProva[];
};

export async function getCalendarioProfessor(desde: string, ate: string): Promise<CalendarioResponse> {
  const { data } = await api.get<CalendarioResponse>('/professor/calendario', { params: { desde, ate } });
  return data;
}
