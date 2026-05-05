import { useCallback, useEffect, useRef, useState } from 'react';

import { apiErrorMessage } from '@/lib/api';
import { salvarExecucao, type NovoRecorde } from '@/lib/api/execucao';
import type { DetalhesMusculacao, SetRealizado, Treino } from '@/types/treino';

export type ExecExercicio = {
  nome: string;
  series: number;
  cargaPctRP?: number;
  cargaKg?: number;
  reps?: number;
  descansoSeg?: number;
  videoUrl?: string;
  realizado: SetRealizado[];
};

export type SyncStatus = 'idle' | 'pending-sync' | 'syncing' | 'synced' | 'error';

export type ExecState = {
  treinoId: string;
  exercicios: ExecExercicio[];
  currentExercicio: number;
  currentSet: number;
  finalizadoLocal: boolean;
  syncStatus: SyncStatus;
  syncError?: string;
};

const storageKey = (treinoId: string) => `apex.exec.${treinoId}`;

function buildInitial(treino: Treino): ExecState {
  if (treino.detalhes.tipo !== 'musculacao') {
    return {
      treinoId: treino.id,
      exercicios: [],
      currentExercicio: 0,
      currentSet: 0,
      finalizadoLocal: false,
      syncStatus: 'idle',
    };
  }
  const detalhes = treino.detalhes as DetalhesMusculacao;
  const exercicios: ExecExercicio[] = detalhes.exercicios.map((ex) => ({
    nome: ex.nome,
    series: ex.prescrito.series,
    cargaPctRP: ex.prescrito.cargaPctRP,
    cargaKg: ex.prescrito.cargaKg,
    reps: ex.prescrito.reps,
    descansoSeg: ex.prescrito.descansoSeg,
    videoUrl: ex.videoUrl,
    realizado: ex.realizado ?? [],
  }));

  // Avança automático para a primeira série incompleta
  let currentExercicio = 0;
  let currentSet = 0;
  for (let i = 0; i < exercicios.length; i++) {
    if (exercicios[i].realizado.length < exercicios[i].series) {
      currentExercicio = i;
      currentSet = exercicios[i].realizado.length;
      break;
    }
    if (i === exercicios.length - 1) {
      currentExercicio = i;
      currentSet = exercicios[i].series; // todas completas → fim
    }
  }

  return {
    treinoId: treino.id,
    exercicios,
    currentExercicio,
    currentSet,
    finalizadoLocal: false,
    syncStatus: 'idle',
  };
}

function loadOrInit(treino: Treino): ExecState {
  const raw = localStorage.getItem(storageKey(treino.id));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ExecState;
      if (parsed.treinoId === treino.id) return parsed;
    } catch { /* ignore */ }
  }
  return buildInitial(treino);
}

export type UseExecucaoTreino = {
  state: ExecState;
  online: boolean;
  novosRecordes: NovoRecorde[];
  totalSeries: number;
  seriesCompletas: number;
  exerciciosCompletos: number;
  isFinalizavel: boolean;
  isFimAtividade: boolean;
  salvarSerie: (kg: number, reps: number, opts?: { rpe?: number; observacao?: string }) => void;
  pularSerie: () => void;
  proximoExercicio: () => void;
  finalizar: () => Promise<NovoRecorde[]>;
  dismissCelebracao: () => void;
  reset: () => void;
};

export function useExecucaoTreino(treino: Treino): UseExecucaoTreino {
  const [state, setState] = useState<ExecState>(() => loadOrInit(treino));
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [novosRecordes, setNovosRecordes] = useState<NovoRecorde[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persiste e atualiza state via updater
  const persist = useCallback((updater: (s: ExecState) => ExecState) => {
    setState((prev) => {
      const next = updater(prev);
      try { localStorage.setItem(storageKey(treino.id), JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, [treino.id]);

  // Listeners online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const salvarSerie = useCallback<UseExecucaoTreino['salvarSerie']>((kg, reps, opts) => {
    persist((s) => {
      const ex = s.exercicios[s.currentExercicio];
      if (!ex) return s;
      const newRealizado = [...ex.realizado];
      newRealizado[s.currentSet] = {
        kg,
        reps,
        rpe: opts?.rpe,
        observacao: opts?.observacao,
        registradoEm: new Date().toISOString(),
      };
      const exsUpdated = s.exercicios.map((e, idx) =>
        idx === s.currentExercicio ? { ...e, realizado: newRealizado } : e,
      );

      let nextEx = s.currentExercicio;
      let nextSet = s.currentSet + 1;
      if (nextSet >= ex.series && nextEx < s.exercicios.length - 1) {
        nextEx += 1;
        nextSet = 0;
      }
      return { ...s, exercicios: exsUpdated, currentExercicio: nextEx, currentSet: nextSet };
    });
  }, [persist]);

  const pularSerie = useCallback(() => {
    persist((s) => {
      const ex = s.exercicios[s.currentExercicio];
      if (!ex) return s;
      let nextEx = s.currentExercicio;
      let nextSet = s.currentSet + 1;
      if (nextSet >= ex.series && nextEx < s.exercicios.length - 1) {
        nextEx += 1;
        nextSet = 0;
      }
      return { ...s, currentExercicio: nextEx, currentSet: nextSet };
    });
  }, [persist]);

  const proximoExercicio = useCallback(() => {
    persist((s) => {
      if (s.currentExercicio >= s.exercicios.length - 1) return s;
      return { ...s, currentExercicio: s.currentExercicio + 1, currentSet: 0 };
    });
  }, [persist]);

  const finalizar = useCallback<UseExecucaoTreino['finalizar']>(async () => {
    const snapshot = stateRef.current;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      persist((s) => ({ ...s, finalizadoLocal: true, syncStatus: 'pending-sync', syncError: undefined }));
      return [];
    }

    persist((s) => ({ ...s, syncStatus: 'syncing', syncError: undefined }));
    try {
      const { novosRecordes: novos } = await salvarExecucao(treino.id, {
        exercicios: snapshot.exercicios.map((e) => ({ nome: e.nome, realizado: e.realizado })),
        status: 'CONCLUIDO',
      });
      setNovosRecordes(novos);
      persist((s) => ({ ...s, finalizadoLocal: true, syncStatus: 'synced' }));
      return novos;
    } catch (err) {
      persist((s) => ({ ...s, syncStatus: 'error', syncError: apiErrorMessage(err) }));
      throw err;
    }
  }, [persist, treino.id]);

  // Auto-retry quando voltar online
  useEffect(() => {
    if (online && stateRef.current.finalizadoLocal && stateRef.current.syncStatus === 'pending-sync') {
      finalizar().catch(() => { /* state guarda erro */ });
    }
  }, [online, finalizar]);

  const dismissCelebracao = useCallback(() => setNovosRecordes([]), []);

  const reset = useCallback(() => {
    localStorage.removeItem(storageKey(treino.id));
    setState(buildInitial(treino));
    setNovosRecordes([]);
  }, [treino]);

  // Métricas derivadas
  const totalSeries = state.exercicios.reduce((acc, e) => acc + e.series, 0);
  const seriesCompletas = state.exercicios.reduce(
    (acc, e) => acc + Math.min(e.realizado.length, e.series),
    0,
  );
  const exerciciosCompletos = state.exercicios.filter(
    (e) => e.realizado.length >= e.series,
  ).length;
  const isFimAtividade =
    state.exercicios.length > 0 && exerciciosCompletos === state.exercicios.length;
  const isFinalizavel = exerciciosCompletos > 0 || seriesCompletas > 0;

  return {
    state,
    online,
    novosRecordes,
    totalSeries,
    seriesCompletas,
    exerciciosCompletos,
    isFinalizavel,
    isFimAtividade,
    salvarSerie,
    pularSerie,
    proximoExercicio,
    finalizar,
    dismissCelebracao,
    reset,
  };
}
