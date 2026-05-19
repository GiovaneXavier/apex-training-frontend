import { api } from '@/lib/api';

// PR #32 — cliente do Weekly Check-in (Sprint 12 / Aluno Intelligence).

export type InsightOrigem = 'llm' | 'fallback-veto' | 'fallback-estatico' | 'sem-dados';

export type InsightResult = {
  summary: string;
  destaques: string[];
  origem: InsightOrigem;
};

export type WeeklyCheckinResponse = {
  result: InsightResult;
  generatedAt: string;
  expiresAt: string;
  fresh: boolean;
  stale: boolean;
  empty: boolean;
};

export async function getWeeklyCheckin(
  opts: { signal?: AbortSignal } = {},
): Promise<WeeklyCheckinResponse> {
  const { data } = await api.get<WeeklyCheckinResponse>('/aluno/weekly-checkin', {
    signal: opts.signal,
  });
  return data;
}

export async function refreshWeeklyCheckin(): Promise<WeeklyCheckinResponse> {
  const { data } = await api.post<WeeklyCheckinResponse>('/aluno/weekly-checkin/refresh');
  return data;
}
