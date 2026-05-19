import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  getWeeklyCheckin,
  refreshWeeklyCheckin,
  type WeeklyCheckinResponse,
} from '@/lib/api/weeklyCheckin';
import { cn } from '@/lib/utils';

// PR #32 — Card de Weekly Check-in no Dashboard do Aluno (Sprint 12).
//
// 4 estados visuais:
//   loading → skeleton.
//   fresh   → narrativa IA + destaques + disclaimer.
//   stale   → mesmo conteúdo + badge "desatualizado" (LLM falhou na regen).
//   empty   → texto neutro ("Semana sem treinos registrados…") sem disclaimer.
//   error   → fallback de UX: mensagem + retry.
//
// DISCLAIMER é renderizado pelo FRONTEND, não vem do LLM. Garantia de
// presença mesmo se LLM esquecer. Mostrado em fresh/stale, não em empty.

type Props = {
  className?: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'data'; data: WeeklyCheckinResponse }
  | { kind: 'error'; message: string };

const DISCLAIMER_TEXT = 'Insight gerado por IA com base no seu histórico. Sempre consulte seu treinador antes de mudar a prescrição.';

export function WeeklyCheckinCard({ className }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getWeeklyCheckin();
        if (!cancelled) setState({ kind: 'data', data });
      } catch (err) {
        if (cancelled || isCancelError(err)) return;
        setState({ kind: 'error', message: apiErrorMessage(err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const data = await refreshWeeklyCheckin();
      setState({ kind: 'data', data });
      toast.success('Insight atualizado');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <div
        data-testid="weekly-checkin-card"
        data-state="loading"
        className={cn(
          'p-4 rounded-[14px] bg-surface border border-app animate-pulse',
          className,
        )}
      >
        <div className="h-3 w-32 bg-app rounded mb-3" />
        <div className="h-3 w-full bg-app rounded mb-2" />
        <div className="h-3 w-3/4 bg-app rounded" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        data-testid="weekly-checkin-card"
        data-state="error"
        className={cn('p-4 rounded-[14px] bg-surface border border-app', className)}
      >
        <p className="text-[12px] text-danger mb-2">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            void getWeeklyCheckin()
              .then((d) => setState({ kind: 'data', data: d }))
              .catch((err) => setState({ kind: 'error', message: apiErrorMessage(err) }));
          }}
          className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const { data } = state;
  const visualState = data.empty ? 'empty' : data.stale ? 'stale' : 'fresh';

  return (
    <div
      data-testid="weekly-checkin-card"
      data-state={visualState}
      data-origem={data.result.origem}
      className={cn(
        'p-4 rounded-[14px] border',
        data.empty ? 'bg-surface border-app'
          : data.stale ? 'bg-surface border-warn/30'
          : 'bg-surface border-accent/30',
        className,
      )}
    >
      <header className="flex items-center justify-between mb-2">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
          🔍 Fechamento da semana
        </div>
        <div className="flex items-center gap-2">
          {data.stale && (
            <span
              data-testid="checkin-stale-badge"
              className="text-mono text-[9px] uppercase tracking-wider text-warn font-bold px-1.5 py-0.5 rounded bg-warn-bg"
            >
              desatualizado
            </span>
          )}
          {!data.empty && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              data-testid="checkin-refresh"
              className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold disabled:opacity-40"
              aria-label="Atualizar fechamento da semana"
            >
              {refreshing ? '…' : '↻'}
            </button>
          )}
        </div>
      </header>

      <p
        className="text-[13px] text-ink mb-3 leading-snug"
        data-testid="checkin-summary"
      >
        {data.result.summary}
      </p>

      {data.result.destaques.length > 0 && (
        <ul className="space-y-1 mb-3" data-testid="checkin-destaques">
          {data.result.destaques.map((d) => (
            <li
              key={d}
              className="text-[11.5px] text-ink-muted flex items-start gap-1.5"
            >
              <span aria-hidden className="text-accent shrink-0">·</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Disclaimer fixo, renderizado pelo frontend. Não vem do LLM —
          presença garantida mesmo se modelo esquecer ou ignorar. Some
          quando empty (texto já é neutro estático). */}
      {!data.empty && (
        <div
          data-testid="checkin-disclaimer"
          className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle leading-snug pt-2 border-t border-app"
        >
          {DISCLAIMER_TEXT}
        </div>
      )}
    </div>
  );
}
