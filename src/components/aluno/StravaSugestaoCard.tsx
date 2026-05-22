import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { useStravaSugestoes } from '@/hooks/useStravaSugestoes';
import type { StravaSugestao } from '@/lib/api/strava';
import { MODALIDADE_LABEL } from '@/types/treino';
import { cn } from '@/lib/utils';

// PR #41c — Card de sugestões Tier 2 do Strava no Dashboard do aluno.
//
// Tier 2 = matches retidos (0.65 ≤ score < 0.92) que o backend não auto-
// vinculou. Aluno decide caso a caso. Botões [Sim]/[Não] disparam:
//   Sim → POST /strava/sugestoes/:id/aceitar → vincula treino + sugestão ACEITA
//   Não → POST /strava/sugestoes/:id/rejeitar → REJEITADA + cooldown anti-resugerir
//
// Não-renderiza nada quando a lista está vazia OU em loading inicial — não é
// elemento herói, aparece "quando tem". Erro renderiza inline (não dá toast)
// pra não competir com toasts de outros sistemas no Dashboard.

type Props = {
  className?: string;
};

const STRAVA_ORANGE = '#fc4c02';

export function StravaSugestaoCard({ className }: Props) {
  const { sugestoes, loading, error, aceitar, rejeitar } = useStravaSugestoes();

  // Loading inicial silencioso — Dashboard tem skeleton próprio no feed.
  // Card de sugestão é informação suplementar, sem skeleton dedicado.
  if (loading && sugestoes.length === 0) return null;

  if (error) {
    return (
      <div
        data-testid="strava-sugestao-card"
        data-state="error"
        className={cn('mx-5 mb-3 p-3 rounded-[10px] bg-danger-bg text-danger text-[11.5px]', className)}
      >
        {error}
      </div>
    );
  }

  if (sugestoes.length === 0) return null;

  async function onAceitar(s: StravaSugestao) {
    try {
      await aceitar(s.id);
      toast.success(`"${s.treino.titulo}" vinculado ao seu Strava`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function onRejeitar(s: StravaSugestao) {
    try {
      await rejeitar(s.id);
      // Sem toast no rejeitar — ação silenciosa (o item sumir já é feedback).
      // Toast só em sucesso aceitar (positive reinforcement) ou erro.
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <div
      data-testid="strava-sugestao-card"
      data-state="data"
      className={cn('mx-5 mb-3', className)}
    >
      <header className="flex items-center gap-2 mb-2">
        <span
          aria-hidden
          className="size-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: STRAVA_ORANGE }}
        >
          S
        </span>
        <h3 className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
          Sugestões do Strava · {sugestoes.length}
        </h3>
      </header>

      <ul className="space-y-2" data-testid="strava-sugestao-list">
        {sugestoes.map((s) => (
          <SugestaoItem
            key={s.id}
            sugestao={s}
            onAceitar={() => onAceitar(s)}
            onRejeitar={() => onRejeitar(s)}
          />
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Item individual
// ─────────────────────────────────────────────────────────────────────
function SugestaoItem({
  sugestao,
  onAceitar,
  onRejeitar,
}: {
  sugestao: StravaSugestao;
  onAceitar: () => void;
  onRejeitar: () => void;
}) {
  const { treino, atividade, score } = sugestao;
  const matchPct = Math.round(score * 100);
  const dataTreino = formatarDataCurta(treino.dataAlvo);
  const dataAtiv = formatarDataCurta(atividade.iniciadoEm);

  return (
    <li
      data-testid="strava-sugestao-item"
      data-sugestao-id={sugestao.id}
      className="p-3 rounded-[14px] bg-surface border border-app"
    >
      {/* Linha 1: titulo do treino + modalidade + match% */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-mono text-[9.5px] uppercase tracking-[0.5px] text-ink-subtle font-bold">
            {MODALIDADE_LABEL[treino.modalidade]} · {dataTreino}
          </div>
          <h4 className="text-[14px] font-bold text-ink leading-tight truncate">
            {treino.titulo}
          </h4>
        </div>
        <span
          data-testid="sugestao-match-pct"
          className="text-mono text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0"
          style={{ backgroundColor: `${STRAVA_ORANGE}20`, color: STRAVA_ORANGE }}
          aria-label={`Confiança ${matchPct}%`}
        >
          {matchPct}%
        </span>
      </div>

      {/* Linha 2: descrição do match — atividade Strava resumida */}
      <p className="text-[11.5px] text-ink-muted leading-snug mb-2.5">
        <span aria-hidden className="mr-1" style={{ color: STRAVA_ORANGE }}>↳</span>
        <span className="font-medium text-ink">{atividade.nome}</span>
        {' · '}
        {formatarDistancia(atividade.distanciaM)}
        {' · '}
        {formatarDuracao(atividade.duracaoSeg)}
        {' · '}
        {dataAtiv}
      </p>

      {/* Linha 3: botões */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAceitar}
          data-testid="sugestao-aceitar"
          className="flex-1 h-9 rounded-[10px] text-white text-[12px] font-bold tracking-tight transition-opacity active:opacity-80"
          style={{ backgroundColor: STRAVA_ORANGE }}
        >
          Sim, é essa
        </button>
        <button
          type="button"
          onClick={onRejeitar}
          data-testid="sugestao-rejeitar"
          className="flex-1 h-9 rounded-[10px] bg-surface border border-app-strong text-ink-muted text-[12px] font-bold tracking-tight transition-colors hover:border-ink-muted"
        >
          Não
        </button>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────────────────────────────
function formatarDistancia(metros: number): string {
  if (metros >= 1000) return `${(metros / 1000).toFixed(metros >= 10_000 ? 1 : 2)} km`;
  return `${metros} m`;
}

function formatarDuracao(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

function formatarDataCurta(iso: string): string {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, '0');
  const mes = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dia}/${mes}`;
}
