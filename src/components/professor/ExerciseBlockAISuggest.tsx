import { useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import {
  postExerciseProgression,
  type ProgressionResponse,
  type TipoProgressao,
} from '@/lib/api/aiProgression';
import { cn } from '@/lib/utils';

// PR #29 — Botão "💡 Sugerir progressão" por bloco de exercício.
//
// Filosofia Human-in-the-Loop:
//   - Click → fetch → mostra popover inline com a sugestão da IA.
//   - Coach clica "Aplicar" → callback preenche `series` + `reps` do form.
//   - cargaEstimadaKg / rpeAlvo / justificativa ficam VISÍVEIS na sugestão
//     pra coach considerar, MAS não autopreenchem `cargaPctRP` (precisaria
//     do RP do aluno pra calcular %; deixamos decisão pro humano).
//   - Botão "Descartar" fecha o popover sem aplicar.
//
// Estados:
//   idle / loading / suggestion / error
//   Nenhuma persistência server-side. Re-click = nova chamada IA (rate-limit
//   server protege).

type Props = {
  alunoId: string;
  exercicioNome: string;
  modalidade?: 'MUSCULACAO' | 'CALISTENIA';
  /** Callback aplicado quando coach confirma. Recebe sets + reps parseado. */
  onApply: (patch: { series: number; reps: number }) => void;
  className?: string;
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'suggestion'; data: ProgressionResponse }
  | { kind: 'error'; message: string };

const TIPO_LABEL: Record<TipoProgressao, string> = {
  intensidade: '↑ Intensidade',
  volume: '+ Volume',
  manutencao: '= Manter',
  deload: '↓ Deload',
};

const TIPO_COLOR: Record<TipoProgressao, string> = {
  intensidade: 'bg-accent/15 text-accent border-accent/30',
  volume: 'bg-warn-bg text-warn border-warn/30',
  manutencao: 'bg-app text-ink-muted border-app-strong',
  deload: 'bg-danger-bg text-danger border-danger/30',
};

// Parse "8-10" → 10 (faixa alta) / "AMRAP" / "Fadiga" → fallback 12 /
// "30s" → 30. UI tem input numérico no form atual; coach edita se quiser
// a faixa baixa. Optamos pela MAIOR como meta progressiva (sobrecarga).
function repsStringToNumber(reps: string): number {
  const range = reps.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  if (range) return Number(range[2]);
  const single = reps.match(/^\s*(\d+)/);
  if (single) return Number(single[1]);
  return 12; // fallback conservador
}

export function ExerciseBlockAISuggest({
  alunoId, exercicioNome, modalidade = 'MUSCULACAO', onApply, className,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const disabledReason =
    !alunoId ? 'Selecione um aluno primeiro' :
    !exercicioNome.trim() ? 'Digite o nome do exercício primeiro' :
    null;

  async function fetchSuggestion() {
    if (disabledReason) return;
    setState({ kind: 'loading' });
    try {
      const data = await postExerciseProgression({ alunoId, exercicioNome, modalidade });
      setState({ kind: 'suggestion', data });
    } catch (err) {
      setState({ kind: 'error', message: apiErrorMessage(err) });
    }
  }

  function apply() {
    if (state.kind !== 'suggestion') return;
    const { sets, reps } = state.data.sugestao;
    onApply({ series: sets, reps: repsStringToNumber(reps) });
    setState({ kind: 'idle' });
    toast.success('Sugestão aplicada · ajuste se necessário');
  }

  function dismiss() {
    setState({ kind: 'idle' });
  }

  return (
    <div className={cn('mt-2 mb-3', className)} data-testid="ai-suggest-root">
      {state.kind === 'idle' && (
        <button
          type="button"
          onClick={fetchSuggestion}
          disabled={!!disabledReason}
          title={disabledReason ?? 'Pedir sugestão de progressão pra IA'}
          data-testid="ai-suggest-button"
          className={cn(
            'w-full h-9 rounded-[10px] border border-accent/40 bg-surface',
            'text-accent text-[11px] font-bold uppercase tracking-wider',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          💡 Sugerir progressão
        </button>
      )}

      {state.kind === 'loading' && (
        <div
          data-testid="ai-suggest-loading"
          className="h-9 rounded-[10px] bg-surface border border-app animate-pulse flex items-center justify-center"
        >
          <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle">
            Consultando IA…
          </span>
        </div>
      )}

      {state.kind === 'error' && (
        <div
          data-testid="ai-suggest-error"
          className="p-2 rounded-[10px] bg-danger-bg text-danger text-[11px] font-medium flex items-center justify-between gap-2"
        >
          <span>{state.message}</span>
          <button
            type="button"
            onClick={fetchSuggestion}
            className="text-mono text-[10px] uppercase tracking-wider font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === 'suggestion' && (
        <SuggestionPopover
          data={state.data}
          onApply={apply}
          onDismiss={dismiss}
        />
      )}
    </div>
  );
}

function SuggestionPopover({
  data, onApply, onDismiss,
}: {
  data: ProgressionResponse;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const { sugestao, contextoUsado } = data;
  return (
    <div
      data-testid="ai-suggest-popover"
      className="p-3 rounded-[12px] bg-surface border border-accent/30"
    >
      <div className="flex items-center justify-between mb-2">
        <span
          data-testid="ai-suggest-tipo"
          data-tipo={sugestao.tipoProgressao}
          className={cn(
            'text-mono text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border',
            TIPO_COLOR[sugestao.tipoProgressao],
          )}
        >
          {TIPO_LABEL[sugestao.tipoProgressao]}
        </span>
        <span className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle">
          {contextoUsado.execucoesConsideradas} exec · RPE {contextoUsado.rpeMedioRecente ?? '—'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <Cell label="Sets" value={String(sugestao.sets)} />
        <Cell label="Reps" value={sugestao.reps} />
        <Cell
          label={sugestao.cargaEstimadaKg != null ? 'Carga' : 'RPE'}
          value={
            sugestao.cargaEstimadaKg != null
              ? `${sugestao.cargaEstimadaKg}kg`
              : (sugestao.rpeAlvo != null ? `RPE ${sugestao.rpeAlvo}` : '—')
          }
        />
      </div>

      <p className="text-[11.5px] text-ink-muted leading-snug mb-3" data-testid="ai-suggest-justificativa">
        {sugestao.justificativa}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          data-testid="ai-suggest-dismiss"
          className="flex-1 h-9 rounded-[10px] bg-surface border border-app text-ink-muted text-[11px] font-bold uppercase tracking-wider"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onApply}
          data-testid="ai-suggest-apply"
          className="flex-1 h-9 rounded-[10px] bg-accent text-accent-ink text-[11px] font-bold uppercase tracking-wider"
        >
          Aplicar séries/reps
        </button>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-bg/40 px-2 py-1.5">
      <div className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle font-bold">{label}</div>
      <div className="text-[13px] font-bold text-ink tabular text-mono">{value}</div>
    </div>
  );
}

// Export pra testes.
export const __internal = { repsStringToNumber };
