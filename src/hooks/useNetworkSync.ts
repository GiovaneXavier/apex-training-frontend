import { useEffect } from 'react';
import { useWorkoutStore } from '@/lib/store/useWorkoutStore';
import { salvarExecucao } from '@/lib/api/execucao';
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
    } catch (err) {
      // Falha numa fila não interrompe as outras. Próximo evento 'online'
      // (ou retry manual) tenta de novo.
      console.warn('[sync] falha ao enviar', item.treinoId, err);
    }
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
