import { api } from '@/lib/api';

// PR #29 — cliente do AI Progression Suggestion.

export type TipoProgressao = 'intensidade' | 'volume' | 'manutencao' | 'deload';

export type SuggestedProgression = {
  sets: number;
  reps: string;                  // "8-10", "AMRAP", "30s"
  cargaEstimadaKg: number | null;
  rpeAlvo: number | null;
  justificativa: string;
  tipoProgressao: TipoProgressao;
};

export type ProgressionResponse = {
  sugestao: SuggestedProgression;
  contextoUsado: {
    execucoesConsideradas: number;
    rpeMedioRecente: number | null;
    houveFalhaDeReps: boolean;
    diasDesdeUltima: number | null;
    modalidade: 'MUSCULACAO' | 'CALISTENIA';
  };
};

export async function postExerciseProgression(args: {
  alunoId: string;
  exercicioNome: string;
  modalidade?: 'MUSCULACAO' | 'CALISTENIA';
}): Promise<ProgressionResponse> {
  const { data } = await api.post<ProgressionResponse>(
    '/coach/ai-progression/exercise',
    {
      alunoId: args.alunoId,
      exercicioNome: args.exercicioNome,
      modalidade: args.modalidade ?? 'MUSCULACAO',
    },
  );
  return data;
}
