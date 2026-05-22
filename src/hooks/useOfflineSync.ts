import { useEffect } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { salvarExecucao } from '@/lib/api/execucao';
import { parseBjjAudio } from '@/lib/api/voice';
import {
  base64ToBlob,
  isVoiceEntry,
  listQueue,
  removeEntry,
} from '@/lib/offline/saveQueue';
import { pruneExpired, saveDraft } from '@/lib/offline/voiceDrafts';

// ─────────────────────────────────────────────────────────────────────
// Drena fila offline (saveQueue) — substitui o antigo useNetworkSync que
// dependia do `useWorkoutStore` órfão (audit #1.12).
//
// PR #25 — passou a tratar dois tipos de entry:
//   - salvar (default): POST /treinos/:id/salvar
//   - voice_pending: POST /voice/parse-bjj → grava resultado em
//     voiceDrafts (NÃO chama salvar). JiuJitsuLive lê o draft no mount
//     do treino correspondente e mostra banner.
//
// Comportamento:
//   - No mount: prune drafts expirados + se online, drena fila.
//   - Evento 'online': drena novamente.
//   - Sequential: ordem cronológica preservada (último-a-chegar não
//     sobrescreve carga errada). saveQueue.listQueue ordena por enqueuedAt.
//   - Toast agregado: contadores separados pra execução e voz.
// ─────────────────────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  const entries = await listQueue();
  if (entries.length === 0) return;

  let saveOk = 0;
  let saveFail = 0;
  let voiceOk = 0;
  let voiceFail = 0;
  let lastErr: string | null = null;

  for (const entry of entries) {
    try {
      if (isVoiceEntry(entry)) {
        const blob = base64ToBlob(entry.audioBase64, entry.audioMime);
        const result = await parseBjjAudio(blob, entry.treinoId);
        // Persiste no repositório de rascunhos — NÃO depende do componente
        // estar montado. Quando o atleta reabrir o treino BJJ, JiuJitsuLive
        // checa getDraft e mostra banner pra aplicar.
        await saveDraft(entry.treinoId, {
          fields: result.fields,
          transcript: result.transcript,
          confidence: result.confidence,
          needsReview: result.needsReview,
          warnings: result.warnings,
          partial: result.partial,
        });
        await removeEntry(entry.id);
        voiceOk++;
      } else {
        await salvarExecucao(entry.treinoId, entry.payload);
        await removeEntry(entry.id);
        saveOk++;
      }
    } catch (err) {
      console.warn('[offline-sync] falha em', entry.treinoId, err);
      if (isVoiceEntry(entry)) voiceFail++;
      else saveFail++;
      lastErr = apiErrorMessage(err);
    }
  }

  // Toasts separados — execução e voz são UX distintas. Voz aciona
  // banner ao reabrir; execução é "treino salvo" definitivo.
  if (saveOk > 0 && saveFail === 0) {
    toast.success(
      saveOk === 1 ? 'Treino sincronizado' : `${saveOk} treinos sincronizados`,
    );
  }
  if (voiceOk > 0 && voiceFail === 0) {
    toast.success(
      voiceOk === 1
        ? 'Diário de voz processado · disponível ao reabrir o treino'
        : `${voiceOk} diários de voz processados · disponíveis ao reabrir`,
    );
  }
  if (saveFail > 0 || voiceFail > 0) {
    const partes: string[] = [];
    if (saveFail > 0) partes.push(`${saveFail} treino${saveFail > 1 ? 's' : ''}`);
    if (voiceFail > 0) partes.push(`${voiceFail} diário${voiceFail > 1 ? 's' : ''} de voz`);
    toast.error(
      `Falha ao sincronizar ${partes.join(' e ')}` +
        (lastErr ? ` · ${lastErr}` : '') +
        '. Vamos tentar de novo quando voltar online.',
      { duration: 6000 },
    );
  }
}

export function useOfflineSync(): void {
  useEffect(() => {
    // Limpeza periódica de rascunhos antigos (TTL 7d) — barata, idempotente.
    void pruneExpired();

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushQueue();
    }
    const onOnline = () => { void flushQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}
