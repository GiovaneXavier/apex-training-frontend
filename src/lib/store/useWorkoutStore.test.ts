import { beforeEach, describe, expect, it } from 'vitest';
import type { Treino } from '@/types/treino';
import { useWorkoutStore } from './useWorkoutStore';

// Fixture mínima de treino musculação — só campos exigidos pelo Treino type.
const fakeTreino = (id: string): Treino => ({
  id,
  alunoId: 'aluno-1',
  professorId: 'prof-1',
  modalidade: 'MUSCULACAO',
  titulo: 'Push A',
  dataAlvo: '2026-05-08',
  status: 'PENDENTE',
  detalhes: {
    tipo: 'musculacao',
    exercicios: [
      { nome: 'Supino reto', prescrito: { series: 4, reps: 8 } },
      { nome: 'Desenvolvimento', prescrito: { series: 3, reps: 10 } },
    ],
  },
  iniciadoEm: null,
  finalizadoEm: null,
  criadoEm: '2026-05-01T00:00:00Z',
  atualizadoEm: '2026-05-01T00:00:00Z',
});

describe('useWorkoutStore', () => {
  beforeEach(() => {
    // Persist async escreve no IDB (jsdom usa fake-indexeddb sob demanda do
    // idb-keyval). Pra testar lógica pura, só zeramos o estado em memória.
    useWorkoutStore.getState().reset();
  });

  describe('cacheTreino', () => {
    it('salva o treino indexado por id e marca lastSyncedAt', () => {
      const t = fakeTreino('t-1');
      useWorkoutStore.getState().cacheTreino(t);

      const s = useWorkoutStore.getState();
      expect(s.treinos['t-1']).toEqual(t);
      expect(s.lastSyncedAt).toBeTypeOf('number');
      expect(s.getCachedTreino('t-1')).toEqual(t);
    });

    it('cacheTreinosList faz merge sem perder anteriores', () => {
      const a = fakeTreino('a');
      const b = fakeTreino('b');
      useWorkoutStore.getState().cacheTreino(a);
      useWorkoutStore.getState().cacheTreinosList([b]);

      const s = useWorkoutStore.getState();
      expect(Object.keys(s.treinos).sort()).toEqual(['a', 'b']);
    });
  });

  describe('registrarSet', () => {
    it('adiciona set novo na fila pending do treino', () => {
      const store = useWorkoutStore.getState();
      store.registrarSet('t-1', 0, 0, { kg: 80, reps: 8, rpe: 7 });

      const pending = useWorkoutStore.getState().pending['t-1'];
      expect(pending).toBeDefined();
      expect(pending.treinoId).toBe('t-1');
      expect(pending.sets).toHaveLength(1);
      expect(pending.sets[0]).toMatchObject({
        exercicioIdx: 0,
        setIdx: 0,
        kg: 80,
        reps: 8,
        rpe: 7,
      });
      expect(pending.sets[0].registradoEm).toBeTypeOf('string');
    });

    it('é idempotente: mesmo (exercicioIdx,setIdx) substitui em vez de duplicar', () => {
      const store = useWorkoutStore.getState();
      store.registrarSet('t-1', 0, 0, { kg: 80, reps: 8 });
      store.registrarSet('t-1', 0, 0, { kg: 82.5, reps: 8 });

      const pending = useWorkoutStore.getState().pending['t-1'];
      expect(pending.sets).toHaveLength(1);
      expect(pending.sets[0].kg).toBe(82.5);
    });

    it('agrupa múltiplos sets no mesmo treino', () => {
      const store = useWorkoutStore.getState();
      store.registrarSet('t-1', 0, 0, { kg: 80, reps: 8 });
      store.registrarSet('t-1', 0, 1, { kg: 80, reps: 7 });
      store.registrarSet('t-1', 1, 0, { kg: 30, reps: 12 });

      expect(useWorkoutStore.getState().pending['t-1'].sets).toHaveLength(3);
    });

    it('clearPending remove só o treino alvo', () => {
      const store = useWorkoutStore.getState();
      store.registrarSet('t-1', 0, 0, { kg: 80, reps: 8 });
      store.registrarSet('t-2', 0, 0, { kg: 90, reps: 6 });
      store.clearPending('t-1');

      const p = useWorkoutStore.getState().pending;
      expect(p['t-1']).toBeUndefined();
      expect(p['t-2']).toBeDefined();
    });
  });
});
