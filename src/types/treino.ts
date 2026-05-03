// Tipos espelhados do backend (src/schemas/treino.schemas.js).
// Mantém em sincronia manualmente — sem zod no front por enquanto.

export type Modalidade =
  | 'MUSCULACAO'
  | 'CORRIDA'
  | 'CICLISMO'
  | 'NATACAO'
  | 'TRIATHLON'
  | 'OUTRO';

export type StatusTreino = 'PENDENTE' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'PULADO';

// ── Detalhes JSON (discriminated union) ─────────────────────────
export type ExercicioPrescrito = {
  series: number;
  reps?: number;
  repsMin?: number;
  repsMax?: number;
  cargaPctRP?: number;
  cargaKg?: number;
  descansoSeg?: number;
  observacao?: string;
};

export type SetRealizado = {
  kg?: number;
  reps?: number;
  rpe?: number;
  observacao?: string;
  registradoEm?: string;
};

export type ExercicioMusc = {
  nome: string;
  videoUrl?: string;
  prescrito: ExercicioPrescrito;
  realizado?: SetRealizado[];
  observacao?: string;
};

export type DetalhesMusculacao = {
  tipo: 'musculacao';
  exercicios: ExercicioMusc[];
  observacao?: string;
};

export type DetalhesCorrida = {
  tipo: 'corrida';
  distanciaKm: number;
  ritmoAlvoMinKm?: string;
  fcAlvoMin?: number;
  fcAlvoMax?: number;
  realizado?: {
    distanciaKm?: number;
    duracaoSeg?: number;
    ritmoMedioMinKm?: string;
    fcMedia?: number;
    stravaActivityId?: string;
  } | null;
  observacao?: string;
};

export type DetalhesCiclismo = {
  tipo: 'ciclismo';
  distanciaKm: number;
  duracaoMin?: number;
  potenciaAlvoW?: number;
  realizado?: {
    distanciaKm?: number;
    duracaoSeg?: number;
    potenciaMediaW?: number;
    stravaActivityId?: string;
  } | null;
  observacao?: string;
};

export type DetalhesNatacao = {
  tipo: 'natacao';
  series: {
    repeticoes: number;
    distanciaM: number;
    estilo?: 'LIVRE' | 'COSTAS' | 'PEITO' | 'BORBOLETA' | 'MEDLEY';
    descansoSeg?: number;
  }[];
  realizado?: {
    distanciaTotalM?: number;
    duracaoSeg?: number;
    observacao?: string;
  } | null;
};

export type DetalhesTriathlon = {
  tipo: 'triathlon';
  blocos: (DetalhesNatacao | DetalhesCiclismo | DetalhesCorrida)[];
  observacao?: string;
};

export type DetalhesOutro = {
  tipo: 'outro';
  descricao: string;
  realizado?: string | null;
};

export type TreinoDetalhes =
  | DetalhesMusculacao
  | DetalhesCorrida
  | DetalhesCiclismo
  | DetalhesNatacao
  | DetalhesTriathlon
  | DetalhesOutro;

// ── Entidade ───────────────────────────────────────────────────
export type Treino = {
  id: string;
  alunoId: string;
  professorId: string | null;
  modalidade: Modalidade;
  titulo: string;
  dataAlvo: string;
  status: StatusTreino;
  detalhes: TreinoDetalhes;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

export type Prova = {
  id: string;
  alunoId: string;
  modalidade: Modalidade;
  nome: string;
  data: string;
  detalhes: Record<string, unknown>;
  criadoEm: string;
};

// ── Helpers ────────────────────────────────────────────────────
export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  MUSCULACAO: 'Musculação',
  CORRIDA: 'Corrida',
  CICLISMO: 'Ciclismo',
  NATACAO: 'Natação',
  TRIATHLON: 'Triathlon',
  OUTRO: 'Outro',
};

export const STATUS_LABEL: Record<StatusTreino, string> = {
  PENDENTE: 'Pendente',
  EM_EXECUCAO: 'Em execução',
  CONCLUIDO: 'Concluído',
  PULADO: 'Pulado',
};
