import { useCallback, useEffect, useRef, useState } from 'react';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  aceitarSugestaoStrava,
  listSugestoesStrava,
  rejeitarSugestaoStrava,
  type StravaSugestao,
} from '@/lib/api/strava';

// PR #41c — Hook de sugestões Tier 2 do Strava.
//
// Por que hook próprio em vez de react-query/SWR: o projeto não usa
// nenhum dos dois ainda (Dashboard/Treino consomem com useEffect+useState
// direto). Manter consistência local pesa mais que abrir um vetor novo
// de dependência num PR de UI.
//
// Estratégia de cache: optimistic remove. Aceitar/rejeitar tira o item
// da lista local IMEDIATAMENTE, antes do POST resolver. Se o servidor
// retornar erro, refetch reidrata a lista — pior caso o item volta.
// É o tradeoff certo aqui: a operação é raríssima de falhar (POST simples,
// transação curta no backend) e a percepção de "clicou e sumiu" é crítica
// pra UX de feedback.

export type UseStravaSugestoesResult = {
  sugestoes: StravaSugestao[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  aceitar: (id: string) => Promise<void>;
  rejeitar: (id: string) => Promise<void>;
};

export function useStravaSugestoes(opts: { enabled?: boolean } = {}): UseStravaSugestoesResult {
  const { enabled = true } = opts;
  const [sugestoes, setSugestoes] = useState<StravaSugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda último signal pra cancelar fetch em curso quando refetch é
  // disparado manualmente (ex: depois de aceitar/rejeitar).
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSugestoesStrava({ signal });
      if (!signal?.aborted) setSugestoes(data);
    } catch (err) {
      if (isCancelError(err)) return;
      setError(apiErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    await fetchData(ctrl.signal);
  }, [fetchData]);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    void fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, [enabled, fetchData]);

  // Helper interno: remove optimisticamente, chama API, reidrata em erro.
  const mutate = useCallback(
    async (id: string, fn: (id: string) => Promise<unknown>) => {
      const snapshot = sugestoes;
      setSugestoes((cur) => cur.filter((s) => s.id !== id));
      try {
        await fn(id);
      } catch (err) {
        // Reidrata e propaga — o caller decide se mostra toast/etc.
        setSugestoes(snapshot);
        throw err;
      }
    },
    [sugestoes],
  );

  const aceitar = useCallback((id: string) => mutate(id, aceitarSugestaoStrava), [mutate]);
  const rejeitar = useCallback((id: string) => mutate(id, rejeitarSugestaoStrava), [mutate]);

  return { sugestoes, loading, error, refetch, aceitar, rejeitar };
}
