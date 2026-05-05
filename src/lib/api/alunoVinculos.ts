import { api } from '@/lib/api';

export type VinculoNutricionistaItem = {
  vinculoId: string;
  nutricionistaId: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  crn?: string | null;
  aceito: boolean;
  desde: string;
};

export type VinculoProfessorItem = {
  vinculoId: string;
  professorId: string;
  nome: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  desde: string;
};

export async function listMinhasNutris(): Promise<VinculoNutricionistaItem[]> {
  const { data } = await api.get<{ nutricionistas: VinculoNutricionistaItem[] }>('/aluno/nutricionistas');
  return data.nutricionistas;
}

export async function aceitarNutri(vinculoId: string): Promise<void> {
  await api.post(`/aluno/nutricionistas/${vinculoId}/aceitar`);
}

export async function recusarNutri(vinculoId: string): Promise<void> {
  await api.delete(`/aluno/nutricionistas/${vinculoId}`);
}

export async function listMeusProfessores(): Promise<VinculoProfessorItem[]> {
  const { data } = await api.get<{ professores: VinculoProfessorItem[] }>('/aluno/professores');
  return data.professores;
}
