import { api } from '@/lib/api';

// PR #18b — Plano Alimentar (PDF + foco/metas).
//
// Contract espelha src/services/plano.service.js no backend. Sem
// referência a outras entidades — payload pequeno (URL + texto).
export type PlanoAlimentar = {
  id: string;
  alunoId: string;
  nutricionistaId: string | null;
  pdfUrl: string;
  pdfKey: string | null;
  metasText: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export type PlanoCreateInput = {
  alunoId: string;
  pdfUrl: string;
  pdfKey?: string;
  metasText?: string;
};

export type PlanoUpdateInput = {
  pdfUrl?: string;
  pdfKey?: string;
  metasText?: string;
};

export async function getPlanoAtual(
  alunoId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<PlanoAlimentar | null> {
  const { data } = await api.get<{ plano: PlanoAlimentar | null }>(
    `/planos-alimentares/aluno/${alunoId}/atual`,
    { signal: opts.signal },
  );
  return data.plano;
}

export async function listPlanos(
  filters: { alunoId: string; ativo?: 'true' | 'false' | 'any'; limit?: number },
  opts: { signal?: AbortSignal } = {},
): Promise<PlanoAlimentar[]> {
  const { data } = await api.get<{ planos: PlanoAlimentar[] }>('/planos-alimentares', {
    params: filters,
    signal: opts.signal,
  });
  return data.planos;
}

export async function createPlano(input: PlanoCreateInput): Promise<PlanoAlimentar> {
  const { data } = await api.post<{ plano: PlanoAlimentar }>('/planos-alimentares', input);
  return data.plano;
}

export async function updatePlano(id: string, input: PlanoUpdateInput): Promise<PlanoAlimentar> {
  const { data } = await api.patch<{ plano: PlanoAlimentar }>(`/planos-alimentares/${id}`, input);
  return data.plano;
}

export async function deletePlano(id: string): Promise<void> {
  await api.delete(`/planos-alimentares/${id}`);
}
