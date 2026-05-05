import { api } from '@/lib/api';

export type ResumoMes = {
  treinos: number;
  atividadesStrava: number;
  distanciaKm: number;
  tempoMin: number;
  tempoFmt: string;       // "12h 25min" ou "45min"
  cargaTotalKg: number;
};

export type Ciclo = {
  pct: number;            // 0-100
  concluidos: number;
  total: number;
  metaTitulo: string;
  distanciaKm: number;
};

export type EstimativaProva = {
  prova: '5K' | '10K' | '15K' | '21K';
  tempo: string | null;   // "24:35" ou null
  pace: string | null;    // "4:55 /km" ou null
};

export type Desempenho = {
  streak: number;
  resumoMes: ResumoMes;
  ciclo: Ciclo;
  estimativasProva: EstimativaProva[] | null;
};

/** GET /api/aluno/:alunoId/desempenho — agregação de Treino + Strava + RPs. */
export async function getDesempenho(alunoId?: string): Promise<Desempenho> {
  const path = alunoId ? `/aluno/${alunoId}/desempenho` : '/aluno/desempenho';
  const { data } = await api.get<Desempenho>(path);
  return data;
}
