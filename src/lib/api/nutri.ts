import { api } from '@/lib/api';
import type { Treino, Prova } from '@/types/treino';

export type AlunoVinculadoNutri = {
  vinculoId: string;
  alunoId: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  aceitoPeloAluno: boolean;
  desde: string;
};

export type NutriAlunoDetalhe = {
  aluno: {
    id: string;
    nome: string;
    email: string;
    avatarUrl?: string | null;
    pesoKg?: number | null;
    alturaCm?: number | null;
  };
  proximosTreinos: Treino[];
  proximasProvas: Prova[];
};

export async function listAlunosNutri(): Promise<AlunoVinculadoNutri[]> {
  const { data } = await api.get<{ alunos: AlunoVinculadoNutri[] }>('/nutri/alunos');
  return data.alunos;
}

export async function solicitarAcesso(email: string): Promise<AlunoVinculadoNutri> {
  const { data } = await api.post<{ vinculo: AlunoVinculadoNutri }>('/nutri/solicitar', { email });
  return data.vinculo;
}

export async function desvincularNutri(vinculoId: string): Promise<void> {
  await api.delete(`/nutri/vinculo/${vinculoId}`);
}

export async function getAlunoDetalheNutri(alunoId: string): Promise<NutriAlunoDetalhe> {
  const { data } = await api.get<NutriAlunoDetalhe>(`/nutri/aluno/${alunoId}`);
  return data;
}
