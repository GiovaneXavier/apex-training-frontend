import { useEffect } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { salvarExecucao } from '@/lib/api/execucao';
import { listQueue, removeEntry } from '@/lib/offline/saveQueue';

// ─────────────────────────────────────────────────────────────────────
// Drena a fila offline (lib/offline/saveQueue) — substitui o antigo
// useNetworkSync que dependia do `useWorkoutStore` órfão (audit #1.12).
//
// Comportamento:
//   - No mount: se já estiver online, tenta drenar a fila persistida
//     entre sessões.
//   - Quando o evento 'online' do navegador dispara: drena novamente.
//   - Sequential, não Promise.all — evita rate-limit do backend e mantém
//     ordem cronológica (último-a-chegar pode preservar carga errada se
//     paralelo). saveQueue.listQueue já ordena por enqueuedAt asc.
//   - Feedback agregado via toast (sucesso plural / falha resumida).
// ─────────────────────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  const entries = await listQueue();
  if (entries.length === 0) return;

  let okCount = 0;
  let failCount = 0;
  let lastErr: string | null = null;

  for (const entry of entries) {
    try {
      await salvarExecucao(entry.treinoId, entry.payload);
      await removeEntry(entry.id);
      okCount++;
    } catch (err) {
      // Falha em uma entry NÃO interrompe o drain — outras podem ter
      // condições diferentes (ex: aluno deletou um treino enquanto
      // offline; resto continua válido).
      console.warn('[offline-sync] falha em', entry.treinoId, err);
      failCount++;
      lastErr = apiErrorMessage(err);
    }
  }

  if (okCount > 0 && failCount === 0) {
    toast.success(
      okCount === 1 ? 'Treino sincronizado' : `${okCount} treinos sincronizados`,
    );
  } else if (failCount > 0) {
    toast.error(
      `Falha ao sincronizar ${failCount} treino${failCount > 1 ? 's' : ''}` +
        (lastErr ? ` · ${lastErr}` : '') +
        '. Vamos tentar de novo quando voltar online.',
      { duration: 6000 },
    );
  }
}

export function useOfflineSync(): void {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushQueue();
    }
    const onOnline = () => { void flushQueue(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}
