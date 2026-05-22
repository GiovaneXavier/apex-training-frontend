import { useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { desfazerMatchStrava } from '@/lib/api/strava';
import { cn } from '@/lib/utils';

// PR #41c — Badge "Vinculado via Strava" + opção de desvincular manual.
//
// Aparece na tela de detalhes do treino quando o backend retorna
// `stravaActivityId` preenchido. Não distingue Tier 1 vs Tier 2 — uma
// vez vinculado, a operação é a mesma: POST /strava/treinos/:id/desfazer-strava
// (backend zera vínculo + grava cooldown anti-resugerir).
//
// Confirmação: usa window.confirm. É um caminho irreversível-ish (vai
// criar MatchRejeitado), mas o aluno pode re-vincular manualmente via
// sugestão futura, então não é catastrófico. Confirm nativo > modal
// custom porque é uma ação raríssima e modal custom adiciona estado.

const STRAVA_ORANGE = '#fc4c02';

type Props = {
  treinoId: string;
  className?: string;
  onDesvinculado?: () => void;
};

export function StravaVinculoBadge({ treinoId, className, onDesvinculado }: Props) {
  const [desvinculando, setDesvinculando] = useState(false);

  async function onDesvincular() {
    const ok = window.confirm(
      'Desvincular esta atividade do Strava? O treino voltará a ficar pendente até nova vinculação.',
    );
    if (!ok) return;
    setDesvinculando(true);
    try {
      await desfazerMatchStrava(treinoId);
      toast.success('Vínculo desfeito');
      onDesvinculado?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDesvinculando(false);
    }
  }

  return (
    <div
      data-testid="strava-vinculo-badge"
      className={cn(
        'flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] border',
        className,
      )}
      style={{
        backgroundColor: `${STRAVA_ORANGE}10`,
        borderColor: `${STRAVA_ORANGE}40`,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="size-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: STRAVA_ORANGE }}
        >
          S
        </span>
        <span
          className="text-mono text-[10px] uppercase tracking-[0.5px] font-bold truncate"
          style={{ color: STRAVA_ORANGE }}
        >
          Vinculado via Strava
        </span>
      </div>
      <button
        type="button"
        onClick={onDesvincular}
        disabled={desvinculando}
        data-testid="strava-desvincular"
        className="text-mono text-[9.5px] uppercase tracking-wider font-bold text-ink-muted hover:text-ink disabled:opacity-50 shrink-0"
        aria-label="Desvincular do Strava"
      >
        {desvinculando ? '…' : 'Desvincular'}
      </button>
    </div>
  );
}
