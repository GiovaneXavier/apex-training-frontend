import { useCallback, useEffect, useRef, useState } from 'react';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import { getAdminMetrics, type AdminMetrics } from '@/lib/api/admin';

// PR #42 — Hook do cockpit do admin.
//
// Mesmo padrão de useStravaSugestoes: fetch inicial via useEffect com
// AbortController, refetch manual exposto pra botão "Atualizar". Sem
// react-query (alinhado com o resto do app que não usa).
//
// Erro NÃO limpa os dados anteriores — mantém o último snapshot bom
// na tela e mostra o erro num banner separado. Operação de admin é
// "olho no número", não pode flashar pra branco numa falha de rede.

export type UseAdminMetricsResult = {
  metrics: AdminMetrics | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useAdminMetrics(): UseAdminMetricsResult {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchOnce = useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const data = await getAdminMetrics({ signal: ctrl.signal });
      if (!ctrl.signal.aborted) setMetrics(data);
    } catch (err) {
      if (isCancelError(err)) return;
      setError(apiErrorMessage(err));
    } finally {
      if (!ctrl.signal.aborted) {
        if (mode === 'initial') setLoading(false);
        else setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchOnce('initial');
    return () => abortRef.current?.abort();
  }, [fetchOnce]);

  const refresh = useCallback(() => fetchOnce('refresh'), [fetchOnce]);

  return { metrics, loading, refreshing, error, refresh };
}
