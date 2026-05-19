import type { ConquistaItem } from '@/lib/api/conquistas';
import { cn } from '@/lib/utils';

// PR #31 — Badge de conquista, reutilizável.
//
// Estados visuais:
//   desbloqueada → ícone colorido por tier, descricao completa, data.
//   locked       → ícone cinza, só hintLocked (sem revelar threshold exato
//                  pra não estragar a surpresa).
// destaque: efeito visual sutil quando o codigo bater (deep-link via
//   ?destaque=X na rota Conquistas).

type Props = {
  conquista: ConquistaItem;
  destaque?: boolean;
};

const TIER_COLOR = {
  bronze: 'bg-amber-900/15 border-amber-700/40 text-amber-200',
  prata: 'bg-slate-500/15 border-slate-400/40 text-slate-200',
  ouro: 'bg-yellow-600/15 border-yellow-500/40 text-yellow-200',
  platina: 'bg-cyan-400/15 border-cyan-300/40 text-cyan-100',
} as const;

export function ConquistaBadge({ conquista, destaque }: Props) {
  const desbloqueada = conquista.desbloqueada;
  return (
    <div
      data-testid={`conquista-${conquista.codigo}`}
      data-tier={conquista.tier}
      data-desbloqueada={desbloqueada}
      data-destaque={destaque ? 'true' : undefined}
      className={cn(
        'p-3 rounded-[12px] border flex items-start gap-3',
        desbloqueada ? TIER_COLOR[conquista.tier] : 'bg-surface border-app opacity-60',
        destaque && 'ring-2 ring-accent ring-offset-2 ring-offset-bg',
      )}
    >
      <span
        className={cn(
          'text-[28px] shrink-0',
          !desbloqueada && 'grayscale opacity-50',
        )}
        aria-hidden
      >
        {conquista.icone}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-bold truncate" data-testid={`conquista-titulo-${conquista.codigo}`}>
            {desbloqueada ? conquista.titulo : conquista.titulo}
          </div>
          <span className="text-mono text-[9px] uppercase tracking-wider font-bold shrink-0">
            {conquista.tier}
          </span>
        </div>
        <p className="text-[11px] text-ink-muted leading-snug mt-0.5">
          {desbloqueada ? conquista.descricao : conquista.hintLocked}
        </p>
        {desbloqueada && conquista.desbloqueadoEm && (
          <div className="text-mono text-[9px] uppercase tracking-wider text-ink-subtle mt-1">
            {new Date(conquista.desbloqueadoEm).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    </div>
  );
}
