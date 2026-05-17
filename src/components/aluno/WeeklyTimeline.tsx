import { useMemo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { inicioSemana, key } from '@/lib/dates';

const DIAS_CURTO = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const CORAL = '#fc4c02';

type Props = {
  /** Data selecionada (apenas o dia importa). */
  selected: Date;
  onSelect: (d: Date) => void;
  /** Set de chaves YYYY-MM-DD que têm pelo menos 1 evento (treino/rotina). */
  diasComEventos?: Set<string>;
  /** Quantidade de dias para mostrar — padrão 7 (semana SEG→DOM). */
  totalDias?: number;
  /** Início customizado (default: segunda-feira da semana corrente). */
  startDate?: Date;
};

/**
 * Fita horizontal de 7 dias com pill coral no dia selecionado.
 * Inspiração: Strava / Apple Fitness.
 *
 * Detalhes mobile-first:
 * - Scroll horizontal (snap) — útil quando totalDias > 7
 * - Hoje marcado com bolinha coral abaixo, mesmo se não selecionado
 * - Dias com eventos têm um ponto pequeno cinza no rodapé
 */
export function WeeklyTimeline({
  selected, onSelect,
  diasComEventos,
  totalDias = 7,
  startDate,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const dias = useMemo(() => {
    const start = startDate ?? inicioSemana(new Date());
    return Array.from({ length: totalDias }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [startDate, totalDias]);

  const todayKey = key(new Date());
  const selectedKey = key(selected);

  // Auto-scroll para o item selecionado quando ele estiver fora da viewport
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const item = c.querySelector<HTMLElement>(`[data-day-key="${selectedKey}"]`);
    if (!item) return;
    const itemRect = item.getBoundingClientRect();
    const containerRect = c.getBoundingClientRect();
    if (itemRect.left < containerRect.left || itemRect.right > containerRect.right) {
      item.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [selectedKey]);

  return (
    <div
      ref={containerRef}
      className="flex gap-1.5 overflow-x-auto -mx-5 px-5 py-2 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*:first-child]:ml-auto [&>*:last-child]:mr-auto"
      role="tablist"
      aria-label="Selecionar dia da semana"
    >
      {dias.map((d) => {
        const k = key(d);
        const isSelected = k === selectedKey;
        const isToday = k === todayKey;
        const tem = diasComEventos?.has(k) ?? false;

        return (
          <button
            key={k}
            data-day-key={k}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(d)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5',
              'flex-shrink-0 snap-center',
              'rounded-2xl transition-all',
              'min-w-[56px] py-2 px-3',
              isSelected
                ? 'text-white shadow-md'
                : 'text-ink-muted bg-transparent hover:bg-surface',
            )}
            style={isSelected ? { backgroundColor: CORAL } : undefined}
          >
            <span
              className={cn(
                'text-center text-[10px] uppercase tracking-[0.6px] font-bold text-mono',
                isSelected ? 'opacity-90' : 'text-ink-subtle',
              )}
            >
              {DIAS_CURTO[d.getDay()]}
            </span>
            <span className="text-center text-[18px] font-bold tabular leading-none">
              {d.getDate()}
            </span>

            {/* Indicadores: hoje (anel) + tem evento (ponto) */}
            <span className="flex items-center gap-1 mt-0.5 h-1">
              {isToday && !isSelected && (
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: CORAL }}
                  aria-label="hoje"
                />
              )}
              {tem && !isSelected && (
                <span
                  className="size-1 rounded-full bg-ink-subtle"
                  aria-label="tem evento"
                />
              )}
              {isSelected && tem && (
                <span className="size-1 rounded-full bg-white/80" aria-hidden />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
// Re-exports de lib/dates (PR #14). Implementações moveram para lá pra
// alinhar com o backend e eliminar duplicação. Mantidos aqui como
// re-export para não quebrar imports existentes do Dashboard.
export { inicioSemana, key, mesmaData } from '@/lib/dates';
