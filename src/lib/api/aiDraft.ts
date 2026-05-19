import { api } from '@/lib/api';

// PR #30 — cliente do AI Plan Drafting (treino).

export type Confianca = 'verde' | 'laranja' | 'vermelho';

export type DraftExercicio = {
  nome: string;
  series: number;
  repsRange: string;
  cargaPctRP: number | null;
  descansoSeg: number;
  exercicioId: string | null;
  nomeCanonico: string | null;
  similarityScore: number;
  confianca: Confianca;
};

export type DraftDia = {
  label: string;
  foco: string;
  exercicios: DraftExercicio[];
};

export type DraftTreinoResponse = {
  titulo: string;
  objetivoResumo: string;
  diasSugeridos: DraftDia[];
  meta: {
    modelo: string;
    exerciciosUnicos: number;
    matchesVerde: number;
    matchesLaranja: number;
    matchesVermelho: number;
  };
};

export async function postDraftTreino(args: {
  prompt: string;
  alunoId?: string;
}): Promise<DraftTreinoResponse> {
  const { data } = await api.post<DraftTreinoResponse>(
    '/coach/ai-draft/treino',
    { prompt: args.prompt, alunoId: args.alunoId },
    // Timeout maior — geração de rotina inteira é ~5-8s no Haiku 4.5.
    { timeout: 45000 },
  );
  return data;
}
