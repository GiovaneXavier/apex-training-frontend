import { get, set, del, keys } from 'idb-keyval';

import type { SalvarPayload } from '@/lib/api/execucao';

// ─────────────────────────────────────────────────────────────────────
// Fila offline de POSTs de execução (corrida, ciclismo, natação, hyrox).
//
// Por que app-level e não SW Background Sync:
//   - Background Sync (workbox-background-sync) tem suporte ruim no Safari
//     iOS (browser dominante no público do app — atletas mobile).
//   - POSTs carregam cookie HttpOnly + header X-CSRF-Token cuja origem é
//     state in-memory do React (api.ts). SW não tem fácil acesso.
//   - Manter fila no app permite UX rica: toast resumido, retry manual,
//     visibilidade da pendência na próxima abertura.
//
// Musculação tem fluxo offline próprio em useExecucaoTreino + retry no
// hook. Esta fila cobre as OUTRAS modalidades — corrida/ciclismo/natação/
// hyrox — cuja UI é single-shot submit (não live tracking).
//
// Storage: idb-keyval (IndexedDB) com chave por entry id. Sobrevive a:
//   - Reload/restart do app
//   - PWA standalone fechado e reaberto
//   - Storage pressure (IDB > localStorage)
// ─────────────────────────────────────────────────────────────────────

const KEY_PREFIX = 'apex.offline.exec.';

export type QueueEntry = {
  id: string;             // uuid local — chave estável para remoção idempotente
  treinoId: string;
  payload: SalvarPayload;
  enqueuedAt: string;     // ISO timestamp — útil para auditoria e ordenação
};

function isEntryKey(k: unknown): k is string {
  return typeof k === 'string' && k.startsWith(KEY_PREFIX);
}

function genId(): string {
  // crypto.randomUUID disponível em todos os browsers que suportam PWA.
  // Fallback paranoico: timestamp + random.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueSaveExecucao(
  treinoId: string,
  payload: SalvarPayload,
): Promise<QueueEntry> {
  const entry: QueueEntry = {
    id: genId(),
    treinoId,
    payload,
    enqueuedAt: new Date().toISOString(),
  };
  await set(KEY_PREFIX + entry.id, entry);
  return entry;
}

export async function listQueue(): Promise<QueueEntry[]> {
  const allKeys = await keys();
  const entryKeys = allKeys.filter(isEntryKey);
  const entries = await Promise.all(entryKeys.map((k) => get<QueueEntry>(k)));
  // Filtra entradas null (storage corrompido) e ordena cronológico — drena
  // na mesma ordem que o atleta gravou pra evitar surpresas de "última edição vence".
  return entries
    .filter((e): e is QueueEntry => e != null && typeof e.id === 'string')
    .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
}

export async function removeEntry(id: string): Promise<void> {
  await del(KEY_PREFIX + id);
}

export async function queueSize(): Promise<number> {
  const allKeys = await keys();
  return allKeys.filter(isEntryKey).length;
}

export async function clearQueue(): Promise<void> {
  const allKeys = await keys();
  const entryKeys = allKeys.filter(isEntryKey);
  await Promise.all(entryKeys.map((k) => del(k)));
}
