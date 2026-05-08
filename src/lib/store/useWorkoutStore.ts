import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Treino, SetRealizado } from '@/types/treino';
import { idbStorage } from './idbStorage';

// Store offline-first dos treinos.
// Cenário-alvo: aluno no ginásio, Render free dormindo (cold start ~30s)
// ou sem 4G no subsolo. Treino baixado previamente continua utilizável,
// e sets executados ficam em fila até a conexão voltar.

type DraftSet = SetRealizado & {
  // chave composta exercicioIndex:setIndex pra patch idempotente
  exercicioIdx: number;
  setIdx: number;
};

type PendingSync = {
  treinoId: string;
  sets: DraftSet[];
  // ISO timestamp da última edição local — fonte da verdade em conflito.
  updatedAt: string;
};

interface WorkoutState {
  // Cache de treinos por id, persistido no IDB
  treinos: Record<string, Treino>;
  // Edições locais ainda não sincronizadas com backend
  pending: Record<string, PendingSync>;
  // Última vez que o cache foi populado (ms epoch) — pra TTL/refresh
  lastSyncedAt: number | null;

  // Cache: chamado após GET /treinos/:id online
  cacheTreino: (treino: Treino) => void;
  cacheTreinosList: (treinos: Treino[]) => void;
  getCachedTreino: (id: string) => Treino | undefined;

  // Edição offline: registra um set executado
  registrarSet: (
    treinoId: string,
    exercicioIdx: number,
    setIdx: number,
    set: SetRealizado,
  ) => void;
  // Limpa fila após sync bem-sucedido
  clearPending: (treinoId: string) => void;

  // Reset global (logout)
  reset: () => void;
}

const initial = {
  treinos: {} as Record<string, Treino>,
  pending: {} as Record<string, PendingSync>,
  lastSyncedAt: null as number | null,
};

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      ...initial,

      cacheTreino: (treino) => {
        set((s) => ({
          treinos: { ...s.treinos, [treino.id]: treino },
          lastSyncedAt: Date.now(),
        }));
      },

      cacheTreinosList: (treinos) => {
        set((s) => {
          const next = { ...s.treinos };
          for (const t of treinos) next[t.id] = t;
          return { treinos: next, lastSyncedAt: Date.now() };
        });
      },

      getCachedTreino: (id) => get().treinos[id],

      registrarSet: (treinoId, exercicioIdx, setIdx, payload) => {
        const now = new Date().toISOString();
        const draft: DraftSet = { ...payload, exercicioIdx, setIdx, registradoEm: now };

        set((s) => {
          const prev = s.pending[treinoId];
          // Substitui set existente (idempotência por exercicioIdx+setIdx),
          // senão acrescenta.
          const sets = prev?.sets ?? [];
          const idx = sets.findIndex(
            (x) => x.exercicioIdx === exercicioIdx && x.setIdx === setIdx,
          );
          const nextSets = idx >= 0
            ? sets.map((x, i) => (i === idx ? draft : x))
            : [...sets, draft];

          return {
            pending: {
              ...s.pending,
              [treinoId]: { treinoId, sets: nextSets, updatedAt: now },
            },
          };
        });
      },

      clearPending: (treinoId) => {
        set((s) => {
          const { [treinoId]: _drop, ...rest } = s.pending;
          return { pending: rest };
        });
      },

      reset: () => set(initial),
    }),
    {
      name: 'apex.workout',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      // Persistir só o que importa para offline — descarta funções e
      // qualquer flag transitória que vier no futuro.
      partialize: (s) => ({
        treinos: s.treinos,
        pending: s.pending,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
);
