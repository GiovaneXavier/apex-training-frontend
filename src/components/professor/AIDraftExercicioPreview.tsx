import type { DraftExercicio } from '@/lib/api/aiDraft';
import { cn } from '@/lib/utils';

// PR #30 — Preview de um exercício do draft IA.
//
// Semáforo de confiança:
//   verde     → match silencioso. Mostra nome canônico do banco direto.
//   laranja   → "IA disse X → catálogo Y". Coach revisa.
//   vermelho  → sem match. Mostra nome do LLM e aviso "selecionar manualmente".
//
// O componente é só visual — quem aplica/edita é o caller (modal).

type Props = {
  exercicio: DraftExercicio;
  index: number;
};

const DOT_COLOR: Record<DraftExercicio['confianca'], string> = {
  verde: 'bg-accent',
  laranja: 'bg-warn',
  vermelho: 'bg-danger',
};

const DOT_LABEL: Record<DraftExercicio['confianca'], string> = {
  verde: 'Match catálogo',
  laranja: 'Verificar match',
  vermelho: 'Selecionar manualmente',
};

export function AIDraftExercicioPreview({ exercicio, index }: Props) {
  const { confianca, nome, nomeCanonico, series, repsRange, cargaPctRP, descansoSeg, similarityScore } = exercicio;

  // Nome principal: canônico se verde/laranja, do LLM se vermelho.
  const nomePrincipal = confianca === 'vermelho' ? nome : (nomeCanonico ?? nome);
  // Subtítulo: só aparece em laranja pra evidenciar a divergência.
  const subtitulo = confianca === 'laranja' && nomeCanonico && nomeCanonico !== nome
    ? `IA: "${nome}"`
    : null;

  return (
    <div
      data-testid={`ai-draft-exercicio-${index}`}
      data-confianca={confianca}
      className={cn(
        'p-2.5 rounded-[10px] border flex items-start gap-2.5',
        confianca === 'verde' && 'bg-surface border-app',
        confianca === 'laranja' && 'bg-warn-bg border-warn/30',
        confianca === 'vermelho' && 'bg-danger-bg border-danger/30',
      )}
    >
      <span
        data-testid={`ai-draft-dot-${index}`}
        title={DOT_LABEL[confianca]}
        aria-label={DOT_LABEL[confianca]}
        className={cn('size-2 rounded-full mt-1.5 shrink-0', DOT_COLOR[confianca])}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-ink truncate" data-testid={`ai-draft-nome-${index}`}>
          {nomePrincipal}
        </div>
        {subtitulo && (
          <div className="text-mono text-[10px] text-warn font-bold uppercase tracking-wider truncate">
            {subtitulo} · sim {(similarityScore * 100).toFixed(0)}%
          </div>
        )}
        {confianca === 'vermelho' && (
          <div className="text-mono text-[10px] text-danger font-bold uppercase tracking-wider">
            Sem match no catálogo
          </div>
        )}
        <div className="text-[11px] text-ink-muted mt-0.5">
          {series}×{repsRange}
          {cargaPctRP != null && ` · ${cargaPctRP}% RP`}
          {' · '}{descansoSeg}s descanso
        </div>
      </div>
    </div>
  );
}
