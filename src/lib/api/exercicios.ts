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

// PR #22 — domínio e tipo de movimento do catálogo (BJJ Expansion).
export type DominioExercicio = 'MUSCULACAO' | 'JIU_JITSU' | 'MOBILIDADE' | 'OUTRO';

export const DOMINIO_LABEL: Record<DominioExercicio, string> = {
  MUSCULACAO: 'Musculação',
  JIU_JITSU: 'Jiu-Jitsu',
  MOBILIDADE: 'Mobilidade',
  OUTRO: 'Outro',
};

export type TipoMovimento =
  | 'DRILL' | 'PASSAGEM' | 'GUARDA' | 'RASPAGEM'
  | 'SUBMISSAO' | 'ENTRADA' | 'SAIDA';

export const TIPO_MOVIMENTO_LABEL: Record<TipoMovimento, string> = {
  DRILL: 'Drill',
  PASSAGEM: 'Passagem',
  GUARDA: 'Guarda',
  RASPAGEM: 'Raspagem',
  SUBMISSAO: 'Submissão',
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
};

export type Exercicio = {
  id: string;
  nome: string;
  videoUrl: string | null;
  imagemUrl: string | null;
  grupoMuscular: GrupoMuscular | null;
  equipamento: string | null;
  instrucoes: string | null;
  // PR #22 — sempre presente (default MUSCULACAO no banco).
  dominio: DominioExercicio;
  posicao: string | null;
  tipoMovimento: TipoMovimento | null;
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
  dominio?: DominioExercicio;
  posicao?: string;
  tipoMovimento?: TipoMovimento;
};

export type ListExerciciosFilters = {
  q?: string;
  grupo?: GrupoMuscular;
  // PR #22 — filtros do picker BJJ.
  dominio?: DominioExercicio;
  tipoMovimento?: TipoMovimento;
  limit?: number;
};

export async function listExercicios(
  filters: ListExerciciosFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<Exercicio[]> {
  const { data } = await api.get<Exercicio[]>('/exercicios', {
    params: filters,
    signal: opts.signal,
  });
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
