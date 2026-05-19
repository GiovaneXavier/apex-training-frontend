import { api } from '@/lib/api';

// PR #28 — cliente do Coach Briefing.
//
// Shape espelha o controller backend. Datas vêm como string ISO no JSON.

export type BriefingAlerta = {
  alunoId: string;
  prioridade: 'alta' | 'media' | 'baixa';
  sinal: string;
  sugestaoAcao: string;
};

export type BriefingBom = {
  alunoId: string;
  motivo: string;
};

export type BriefingResult = {
  summary: string;
  alunosEmAlerta: BriefingAlerta[];
  alunosBemEncaminhados: BriefingBom[];
};

export type BriefingResponse = {
  result: BriefingResult;
  generatedAt: string;
  expiresAt: string;
  fresh: boolean;
  stale: boolean;
  empty: boolean;
  alunosVinculadosTotal: number;
  alunosResiduais: number;
};

export async function getCoachBriefing(): Promise<BriefingResponse> {
  const { data } = await api.get<BriefingResponse>('/coach/briefing');
  return data;
}

export async function refreshCoachBriefing(): Promise<BriefingResponse> {
  const { data } = await api.post<BriefingResponse>('/coach/briefing/refresh');
  return data;
}
