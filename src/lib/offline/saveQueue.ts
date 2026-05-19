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

// PR #25 — fila híbrida: salvar execucao + voice diary pending.
// kind discrimina o tipo; drain processa cada um diferente. Default
// 'salvar' mantém retrocompat com entries pré-PR #25 (que não tinham kind).

export type SalvarQueueEntry = {
  id: string;
  kind?: 'salvar';        // default — entries antigas sem campo são salvar
  treinoId: string;
  payload: SalvarPayload;
  enqueuedAt: string;
};

export type VoiceQueueEntry = {
  id: string;
  kind: 'voice_pending';
  treinoId: string;
  audioBase64: string;    // blob → base64 pra sobreviver no IDB (JSON-safe)
  audioMime: string;
  enqueuedAt: string;
};

export type QueueEntry = SalvarQueueEntry | VoiceQueueEntry;

export function isVoiceEntry(e: QueueEntry): e is VoiceQueueEntry {
  return (e as VoiceQueueEntry).kind === 'voice_pending';
}

export function isSalvarEntry(e: QueueEntry): e is SalvarQueueEntry {
  // entries antigas (sem kind) também são salvar
  return !isVoiceEntry(e);
}

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
): Promise<SalvarQueueEntry> {
  const entry: SalvarQueueEntry = {
    id: genId(),
    kind: 'salvar',
    treinoId,
    payload,
    enqueuedAt: new Date().toISOString(),
  };
  await set(KEY_PREFIX + entry.id, entry);
  return entry;
}

// PR #25 — enfileira áudio gravado offline. Drain (useOfflineSync) chama
// parseBjjAudio quando rede volta e persiste resultado em voiceDrafts pra
// que JiuJitsuLive possa hidratar mesmo se desmontado entre gravação e
// processamento.
export async function enqueueVoicePending(
  treinoId: string,
  audioBlob: Blob,
): Promise<VoiceQueueEntry> {
  const audioBase64 = await blobToBase64(audioBlob);
  const entry: VoiceQueueEntry = {
    id: genId(),
    kind: 'voice_pending',
    treinoId,
    audioBase64,
    audioMime: audioBlob.type || 'audio/webm',
    enqueuedAt: new Date().toISOString(),
  };
  await set(KEY_PREFIX + entry.id, entry);
  return entry;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // Conversão chunked pra evitar stack overflow em buffers maiores
  // (apply(null, arr) estoura se arr.length > ~120k em alguns engines).
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
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
