import axios from 'axios';

import { api } from '@/lib/api';
import { enqueueSaveExecucao, type QueueEntry } from '@/lib/offline/saveQueue';
import type { SetRealizado, Treino } from '@/types/treino';

export type NovoRecorde = {
  id: string;
  exercicio: string;
  valor: number;
  unidade: string;
  reps: number | null;
  dataRecorde: string;
  anterior: { valor: number; dataRecorde: string } | null;
};

export type SalvarPayload = {
  exercicios?: Array<{ nome: string; realizado: SetRealizado[] }>;
  realizado?: Record<string, unknown>;
  status?: 'CONCLUIDO' | 'PULADO';
  finalizadoEm?: string;
};

export type SalvarResponse = {
  treino: Treino;
  novosRecordes: NovoRecorde[];
};

export async function salvarExecucao(treinoId: string, payload: SalvarPayload): Promise<SalvarResponse> {
  const { data } = await api.post<SalvarResponse>(`/treinos/${treinoId}/salvar`, payload);
  return data;
}

// ─────────────────────────────────────────────────────────────────────
// Offline-first wrapper (PR #9)
//
// Quando online: tenta o POST normalmente, retorna `{kind: 'synced'}`.
// Quando offline OU rede falha sem response: enfileira no IndexedDB e
//   retorna `{kind: 'queued'}`. O hook useOfflineSync drena ao voltar
//   conexão, mostrando toast no resultado.
//
// Erros do BACKEND (4xx/5xx com response) NÃO enfileiram — são de
// negócio (validação, auth) e enfileirar só esconderia o problema do
// atleta. Apenas falhas de transporte (ERR_NETWORK, sem response) viram
// fila.
//
// Musculação NÃO usa este wrapper — `useExecucaoTreino` tem seu próprio
// retry baseado em localStorage. Wrapper é só pra Live components single-
// shot: Corrida/Ciclismo/Natação/Hyrox.
// ─────────────────────────────────────────────────────────────────────

export type SaveResult =
  | { kind: 'synced'; response: SalvarResponse }
  | { kind: 'queued'; entry: QueueEntry };

function isNetworkError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  // axios.isAxiosError + sem response = falha de transporte (offline, DNS,
  // CORS pre-flight, timeout). 4xx/5xx têm response → não é network.
  return !err.response;
}

export async function salvarExecucaoOfflineFirst(
  treinoId: string,
  payload: SalvarPayload,
): Promise<SaveResult> {
  const offlineUpfront = typeof navigator !== 'undefined' && navigator.onLine === false;

  if (offlineUpfront) {
    const entry = await enqueueSaveExecucao(treinoId, payload);
    return { kind: 'queued', entry };
  }

  try {
    const response = await salvarExecucao(treinoId, payload);
    return { kind: 'synced', response };
  } catch (err) {
    // Só enfileira em falha de transporte. Erros de backend rethrow para
    // o catch da página tratar (toast.error).
    if (isNetworkError(err)) {
      const entry = await enqueueSaveExecucao(treinoId, payload);
      return { kind: 'queued', entry };
    }
    throw err;
  }
}
