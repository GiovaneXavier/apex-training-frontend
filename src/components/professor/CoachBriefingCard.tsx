import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import {
  getCoachBriefing,
  refreshCoachBriefing,
  type BriefingResponse,
} from '@/lib/api/coachBriefing';
import { cn } from '@/lib/utils';

// PR #28 — Card do Briefing IA no Dashboard do Professor.
//
// 5 estados visuais:
//   loading  → spinner, primeira carga
//   empty    → coach sem alunos vinculados ainda
//   fresh    → briefing válido, banner "Atualizado HH:MM"
//   stale    → briefing antigo (LLM caiu), badge amarelo "desatualizado"
//   error    → falha total e sem cache; CTA retry
//
// Click em aluno em alerta → /professor/aluno/:id (rota existente).

type State =
  | { kind: 'loading' }
  | { kind: 'data'; data: BriefingResponse }
  | { kind: 'error'; message: string };

const PRIORIDADE_DOTS: Record<string, string> = {
  alta: 'bg-danger',
  media: 'bg-warn',
  baixa: 'bg-accent',
};

export function CoachBriefingCard() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getCoachBriefing();
        if (!cancelled) setState({ kind: 'data', data });
      } catch (err) {
        if (!cancelled) setState({ kind: 'error', message: apiErrorMessage(err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      const data = await refreshCoachBriefing();
      setState({ kind: 'data', data });
      toast.success('Briefing atualizado');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <div
        data-testid="coach-briefing-card"
        data-state="loading"
        className="p-4 rounded-[14px] bg-surface border border-app animate-pulse"
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
        data-testid="coach-briefing-card"
        data-state="error"
        className="p-4 rounded-[14px] bg-surface border border-app"
      >
        <p className="text-[12px] text-danger mb-3">{state.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ kind: 'loading' });
            void getCoachBriefing()
              .then((data) => setState({ kind: 'data', data }))
              .catch((err) => setState({ kind: 'error', message: apiErrorMessage(err) }));
          }}
          className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const { data } = state;

  if (data.empty) {
    return (
      <div
        data-testid="coach-briefing-card"
        data-state="empty"
        className="p-4 rounded-[14px] bg-surface border border-app"
      >
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
          🧠 Briefing semanal
        </div>
        <p className="text-[12px] text-ink-muted">{data.result.summary}</p>
      </div>
    );
  }

  const stateAttr = data.stale ? 'stale' : 'fresh';

  return (
    <div
      data-testid="coach-briefing-card"
      data-state={stateAttr}
      className="p-4 rounded-[14px] bg-surface border border-app"
    >
      <header className="flex items-center justify-between mb-3">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
          🧠 Briefing semanal
        </div>
        <div className="flex items-center gap-2">
          {data.stale && (
            <span
              data-testid="stale-badge"
              className="text-mono text-[9px] uppercase tracking-wider text-warn font-bold px-1.5 py-0.5 rounded bg-warn-bg"
            >
              desatualizado
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            data-testid="briefing-refresh"
            className="text-mono text-[10px] uppercase tracking-wider text-ink-muted font-bold disabled:opacity-40"
            aria-label="Atualizar briefing"
          >
            {refreshing ? '…' : '↻'}
          </button>
        </div>
      </header>

      <p className="text-[13px] text-ink mb-3 leading-snug">{data.result.summary}</p>

      {data.result.alunosEmAlerta.length > 0 && (
        <div className="mb-3">
          <div className="text-mono text-[9px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
            Atenção
          </div>
          <ul className="space-y-1.5">
            {data.result.alunosEmAlerta.map((a) => (
              <li key={a.alunoId}>
                <Link
                  to={`/professor/aluno/${a.alunoId}`}
                  className="flex items-start gap-2 text-[12px] text-ink hover:text-accent"
                  data-testid={`alerta-${a.alunoId}`}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full mt-1.5 shrink-0',
                      PRIORIDADE_DOTS[a.prioridade] ?? 'bg-app',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">
                    <strong>{a.sinal}</strong>
                    <span className="block text-[11px] text-ink-muted">{a.sugestaoAcao}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.result.alunosBemEncaminhados.length > 0 && (
        <div className="mb-2">
          <div className="text-mono text-[9px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
            No rumo
          </div>
          <ul className="space-y-1">
            {data.result.alunosBemEncaminhados.map((b) => (
              <li key={b.alunoId} className="text-[11px] text-ink-muted">
                <Link
                  to={`/professor/aluno/${b.alunoId}`}
                  className="hover:text-accent"
                  data-testid={`bom-${b.alunoId}`}
                >
                  {b.motivo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.alunosResiduais > 0 && (
        <div className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle">
          + {data.alunosResiduais} alunos fora deste resumo
        </div>
      )}
    </div>
  );
}

export default CoachBriefingCard;
