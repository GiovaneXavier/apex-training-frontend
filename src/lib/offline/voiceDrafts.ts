import { get, set, del, keys } from 'idb-keyval';

import type { VoiceExtractResult } from '@/lib/api/voice';

// PR #25 — Repositório local de rascunhos do Diário de Voz.
//
// PROBLEMA QUE RESOLVE:
//   O atleta grava o áudio no vestiário OFFLINE → fecha o PWA → vai pra
//   rua → 4G volta → useOfflineSync drena em background. Se o JiuJitsuLive
//   já estiver desmontado nesse momento, um custom event no document
//   dispara no vazio e o JSON processado se perde.
//
// SOLUÇÃO:
//   Drain persiste o resultado nesta store. Quando o atleta reabrir o
//   treino, JiuJitsuLive checa getDraft(treinoId) no mount e mostra
//   banner "Encontramos um diário de voz processado — aplicar?".
//
// TTL: 7 dias. Limpeza no boot via pruneExpired(). Sem TTL o IDB enche
// com rascunhos antigos de treinos já salvos manualmente.
//
// Namespace separado do saveQueue (KEY_PREFIX diferente) — rascunho não
// é um POST pendente, é um cache de resultado processado.

const KEY_PREFIX = 'apex.voiceDraft.';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type VoiceDraft = {
  treinoId: string;
  fields: VoiceExtractResult['fields'];
  transcript: string | null;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  partial: boolean;
  processedAt: string; // ISO
};

function keyFor(treinoId: string): string {
  return KEY_PREFIX + treinoId;
}

function isDraftKey(k: unknown): k is string {
  return typeof k === 'string' && k.startsWith(KEY_PREFIX);
}

export async function saveDraft(
  treinoId: string,
  data: Omit<VoiceDraft, 'treinoId' | 'processedAt'>,
): Promise<VoiceDraft> {
  const draft: VoiceDraft = {
    treinoId,
    ...data,
    processedAt: new Date().toISOString(),
  };
  await set(keyFor(treinoId), draft);
  return draft;
}

export async function getDraft(treinoId: string): Promise<VoiceDraft | null> {
  const raw = await get<VoiceDraft>(keyFor(treinoId));
  if (!raw) return null;
  // Stale → trata como ausente E limpa (não polui a próxima leitura).
  if (isExpired(raw)) {
    await del(keyFor(treinoId));
    return null;
  }
  return raw;
}

export async function clearDraft(treinoId: string): Promise<void> {
  await del(keyFor(treinoId));
}

// Limpeza periódica — chamada uma vez no boot do app pra purgar drafts
// que o atleta nunca aplicou (treino salvo manualmente, etc).
export async function pruneExpired(): Promise<number> {
  const allKeys = await keys();
  const draftKeys = allKeys.filter(isDraftKey);
  let removed = 0;
  for (const k of draftKeys) {
    const draft = await get<VoiceDraft>(k);
    if (!draft || isExpired(draft)) {
      await del(k);
      removed++;
    }
  }
  return removed;
}

function isExpired(draft: VoiceDraft): boolean {
  const processed = Date.parse(draft.processedAt);
  if (Number.isNaN(processed)) return true; // dado corrompido = expira
  return Date.now() - processed > TTL_MS;
}

// Para testes — limpa tudo da store de drafts sem mexer no resto do IDB.
export async function clearAllDrafts(): Promise<void> {
  const allKeys = await keys();
  const draftKeys = allKeys.filter(isDraftKey);
  await Promise.all(draftKeys.map((k) => del(k)));
}
