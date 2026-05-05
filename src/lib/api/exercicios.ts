import { api } from '@/lib/api';

export type GrupoMuscular =
  | 'PEITO' | 'COSTAS' | 'OMBRO' | 'BICEPS' | 'TRICEPS' | 'ANTEBRACO'
  | 'ABDOMEN' | 'GLUTEO' | 'QUADRICEPS' | 'POSTERIOR' | 'PANTURRILHA'
  | 'CARDIO' | 'CORE' | 'OUTRO';

export const GRUPO_MUSCULAR_LABEL: Record<GrupoMuscular, string> = {
  PEITO: 'Peito',
  COSTAS: 'Costas',
  OMBRO: 'Ombro',
  BICEPS: 'Bíceps',
  TRICEPS: 'Tríceps',
  ANTEBRACO: 'Antebraço',
  ABDOMEN: 'Abdômen',
  GLUTEO: 'Glúteo',
  QUADRICEPS: 'Quadríceps',
  POSTERIOR: 'Posterior',
  PANTURRILHA: 'Panturrilha',
  CARDIO: 'Cardio',
  CORE: 'Core',
  OUTRO: 'Outro',
};

export type Exercicio = {
  id: string;
  nome: string;
  videoUrl: string | null;
  imagemUrl: string | null;
  grupoMuscular: GrupoMuscular | null;
  equipamento: string | null;
  instrucoes: string | null;
  criadoPorId: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type ExercicioInput = {
  nome: string;
  videoUrl?: string;
  imagemUrl?: string;
  grupoMuscular?: GrupoMuscular;
  equipamento?: string;
  instrucoes?: string;
};

export async function listExercicios(filters: { q?: string; grupo?: GrupoMuscular; limit?: number } = {}): Promise<Exercicio[]> {
  const { data } = await api.get<Exercicio[]>('/exercicios', { params: filters });
  return data;
}

export async function getExercicio(id: string): Promise<Exercicio> {
  const { data } = await api.get<Exercicio>(`/exercicios/${id}`);
  return data;
}

export async function createExercicio(input: ExercicioInput): Promise<Exercicio> {
  const { data } = await api.post<Exercicio>('/exercicios', input);
  return data;
}

export async function updateExercicio(id: string, input: Partial<ExercicioInput>): Promise<Exercicio> {
  const { data } = await api.put<Exercicio>(`/exercicios/${id}`, input);
  return data;
}

export async function deleteExercicio(id: string): Promise<void> {
  await api.delete(`/exercicios/${id}`);
}
