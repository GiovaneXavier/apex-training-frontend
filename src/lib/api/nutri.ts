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
  // PR #18a — flag para gate visual. Hoje sempre `true` quando o
  // detalhe carrega (backend retorna 403 se aceite não cravado), mas
  // a flag viaja no payload pro front conseguir desabilitar botões
  // de escrita caso o estado mude (defesa em profundidade UX).
  aceitoPeloAluno: boolean;
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

export async function getAlunoDetalheNutri(
  alunoId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<NutriAlunoDetalhe> {
  const { data } = await api.get<NutriAlunoDetalhe>(`/nutri/aluno/${alunoId}`, {
    signal: opts.signal,
  });
  return data;
}
