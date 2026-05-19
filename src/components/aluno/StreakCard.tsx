import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import { getStreak, type StreakResponse } from '@/lib/api/conquistas';
import { cn } from '@/lib/utils';

// PR #31 — Card de streak no Dashboard do aluno (Sprint 11).
//
// 3 estados visuais por valor de `atual`:
//   ≥ 4   → 🔥 destacado (atleta consolidado)
//   1-3   → 🌱 neutro positivo (construindo hábito)
//   0     → 💤 neutro SEM shame (mensagem encorajadora, não punitiva)
//
// Dot row das últimas 12 semanas — GitHub-style. Hover/title mostra
// atividades por semana. Click card todo → /aluno/conquistas.

type Props = {
  className?: string;
};

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; data: StreakResponse }
  | { kind: 'error'; message: string };

export function StreakCard({ className }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getStreak();
        if (!cancelled) setState({ kind: 'ready', data });
      } catch (err) {
        if (cancelled || isCancelError(err)) return;
        setState({ kind: 'error', message: apiErrorMessage(err) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.kind === 'loading') {
    return (
      <div
        data-testid="streak-card"
        data-state="loading"
        className={cn(
          'p-4 rounded-[14px] bg-surface border border-app animate-pulse',
          className,
        )}
      >
        <div className="h-3 w-24 bg-app rounded mb-3" />
        <div className="h-8 w-20 bg-app rounded" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div
        data-testid="streak-card"
        data-state="error"
        className={cn('p-4 rounded-[14px] bg-surface border border-app', className)}
      >
        <p className="text-[12px] text-ink-muted">Não foi possível carregar o streak.</p>
      </div>
    );
  }

  const { atual, maximoHistorico, semanasUltimas12 } = state.data;
  const tier = atual >= 4 ? 'fire' : atual >= 1 ? 'sprout' : 'rest';
  const icone = tier === 'fire' ? '🔥' : tier === 'sprout' ? '🌱' : '💤';
  const mensagem =
    tier === 'fire' ? `${atual} semanas consecutivas`
    : tier === 'sprout' ? `${atual} semana${atual > 1 ? 's' : ''} — construindo o hábito`
    : 'Faça 3 treinos esta semana pra começar';

  return (
    <Link
      to="/aluno/conquistas"
      data-testid="streak-card"
      data-state={tier}
      className={cn(
        'block p-4 rounded-[14px] border transition-colors',
        tier === 'fire' && 'bg-accent/5 border-accent/30',
        tier === 'sprout' && 'bg-surface border-app',
        tier === 'rest' && 'bg-surface border-app',
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[20px]" aria-hidden>{icone}</span>
          <span className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
            Streak
          </span>
        </div>
        {maximoHistorico > atual && maximoHistorico > 0 && (
          <span
            data-testid="streak-recorde"
            className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle font-bold"
          >
            recorde {maximoHistorico}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span
          data-testid="streak-atual"
          className={cn(
            'text-[32px] font-bold tabular text-mono leading-none',
            tier === 'fire' && 'text-accent',
            tier !== 'fire' && 'text-ink',
          )}
        >
          {atual}
        </span>
        <span className="text-[11px] text-ink-muted">{mensagem}</span>
      </div>

      <div data-testid="streak-dotrow" className="flex gap-1">
        {semanasUltimas12.map((s, i) => (
          <span
            key={s.semana}
            data-testid={`streak-dot-${i}`}
            data-valida={s.valida}
            title={`${s.semana}: ${s.atividades} atividades`}
            aria-label={`Semana de ${s.semana}, ${s.atividades} atividades`}
            className={cn(
              'flex-1 h-2 rounded-[3px]',
              s.valida ? 'bg-accent' : 'bg-app',
            )}
          />
        ))}
      </div>
    </Link>
  );
}
