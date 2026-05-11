import { useEffect } from 'react';
import { toast } from 'sonner';

import { useWorkoutStore } from '@/lib/store/useWorkoutStore';
import { salvarExecucao } from '@/lib/api/execucao';
import { apiErrorMessage } from '@/lib/api';
import type { SetRealizado, Treino } from '@/types/treino';

// Sync da fila offline → backend.
// Dispara quando o evento 'online' do navegador volta. Idempotente:
// se a chamada já tiver sido feita por outra instância, o backend
// recebe o mesmo payload e deduplica via timestamps no `realizado`.

type DraftSet = SetRealizado & { exercicioIdx: number; setIdx: number };

// Reconstitui o payload `exercicios: [{nome, realizado[]}]` esperado pelo
// endpoint POST /treinos/:id/salvar a partir da fila indexada por idx.
// Precisa do treino cacheado pra resolver `exercicioIdx → nome`.
function buildPayload(treino: Treino, sets: DraftSet[]) {
  // Narrow + alias local — o TS perde o narrow do union dentro do `.map()`
  // se acessarmos `treino.detalhes` direto lá; alias preserva.
  const detalhes = treino.detalhes;
  if (detalhes.tipo !== 'musculacao') return null;

  const porExercicio = new Map<number, SetRealizado[]>();
  for (const s of sets) {
    const arr = porExercicio.get(s.exercicioIdx) ?? [];
    // Drop fields internos do draft antes de mandar pra API
    const { exercicioIdx: _eIdx, setIdx, ...realizado } = s;
    // Garante ordem dos sets pelo setIdx original
    arr[setIdx] = realizado;
    porExercicio.set(s.exercicioIdx, arr);
  }

  const exercicios = Array.from(porExercicio.entries())
    .map(([idx, realizado]) => {
      const nome = detalhes.exercicios[idx]?.nome;
      if (!nome) return null;
      // Filtra furos (caso algum setIdx tenha pulado)
      return { nome, realizado: realizado.filter(Boolean) };
    })
    .filter((x): x is { nome: string; realizado: SetRealizado[] } => x !== null);

  return exercicios.length > 0 ? { exercicios } : null;
}

async function flushPending(): Promise<void> {
  const { pending, treinos, clearPending } = useWorkoutStore.getState();
  const entries = Object.values(pending);
  if (entries.length === 0) return;

  let okCount = 0;
  let failCount = 0;
  let lastErrMsg: string | null = null;

  // Sequencial em vez de Promise.all: evita estouro de rate-limit do
  // backend no Render free e mantém ordem determinística de logs.
  for (const item of entries) {
    try {
      const treino = treinos[item.treinoId];
      if (!treino) {
        // Sem treino cacheado não conseguimos reconstituir o payload.
        // Drop a fila pra não vazar pendências orfãs entre logins.
        clearPending(item.treinoId);
        continue;
      }
      const payload = buildPayload(treino, item.sets);
      if (!payload) {
        clearPending(item.treinoId);
        continue;
      }
      await salvarExecucao(item.treinoId, payload);
      clearPending(item.treinoId);
      okCount++;
    } catch (err) {
      // Falha numa fila não interrompe as outras. Próximo evento 'online'
      // (ou retry manual) tenta de novo.
      console.warn('[sync] falha ao enviar', item.treinoId, err);
      failCount++;
      lastErrMsg = apiErrorMessage(err);
    }
  }

  // Feedback agregado — uma única toast cobrindo o batch.
  // Audit #4.4: antes ficava só em console.warn (silencioso pro atleta).
  if (okCount > 0 && failCount === 0) {
    toast.success(
      okCount === 1 ? 'Treino sincronizado' : `${okCount} treinos sincronizados`,
    );
  } else if (failCount > 0) {
    toast.error(
      `Falha ao sincronizar ${failCount} treino${failCount > 1 ? 's' : ''}` +
        (lastErrMsg ? ` · ${lastErrMsg}` : '') +
        '. Tentaremos de novo quando voltar online.',
      { duration: 6000 },
    );
  }
}

export function useNetworkSync(): void {
  useEffect(() => {
    // Caso já esteja online no mount e haja fila acumulada de uma sessão
    // anterior, drena imediatamente.
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushPending();
    }

    const onOnline = () => {
      void flushPending();
    };

    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
}
