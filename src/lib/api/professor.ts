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

// PR #17 — Coach Analytics: alertas de aderência por aluno vinculado.
// Contrato espelha o shape de `Alerta` no backend (services/coach.service.js).
export type AlertaTipo =
  | 'INACTIVE_7D'
  | 'MISSED_WORKOUT'
  | 'STREAK_BROKEN'
  | 'MODALIDADE_GAP';

export type AlertaSeveridade = 'high' | 'medium' | 'low';

export type Alerta = {
  alunoId: string;
  alunoNome: string;
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  detalhe: string;
  modalidade?: Modalidade;
  treinoId?: string;
  desde: string | null;
};

export async function listAlertasProf(
  opts: { signal?: AbortSignal } = {},
): Promise<Alerta[]> {
  const { data } = await api.get<{ alertas: Alerta[] }>('/professor/alertas', {
    signal: opts.signal,
  });
  return data.alertas;
}

export async function getDashboard(opts: { signal?: AbortSignal } = {}): Promise<ProfessorDashboard> {
  const { data } = await api.get<ProfessorDashboard>('/professor/dashboard', {
    signal: opts.signal,
  });
  return data;
}

export async function listAlunos(): Promise<AlunoVinculado[]> {
  const { data } = await api.get<{ alunos: AlunoVinculado[] }>('/professor/alunos');
  return data.alunos;
}

// PR #14 (audit 2.21) — resposta genérica anti-enumeration. O backend
// não retorna mais o aluno vinculado; a UI deve recarregar a listagem
// pra confirmar. Mensagem default cobre o caso de uso (sucesso ou
// "email não pertence a um aluno cadastrado").
export type VincularResultado = { ok: boolean; message: string };

export async function vincularPorEmail(email: string): Promise<VincularResultado> {
  const { data } = await api.post<VincularResultado>('/professor/vincular', { email });
  return data;
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
