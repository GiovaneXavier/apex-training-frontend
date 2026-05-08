import { getTheme, type DensityName } from '@/themes/tokens';

type Theme = ReturnType<typeof getTheme>;

type Props = {
  t: Theme;
  density: DensityName;
  /** índice do exercício ativo (0-based) */
  activeIdx: number;
  /** total de exercícios no treino */
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onOpenList: () => void;
};

// Barra de navegação rápida entre exercícios.
// Ao contrário do `NextExerciseBar` (só aparece quando o ex atual está
// completo), esta sempre permite avançar/voltar — caso de uso:
// aparelho ocupado no ginásio, aluno pula e volta depois.
export function WorkoutNavBar({ t, density, activeIdx, total, onPrev, onNext, onOpenList }: Props) {
  const D = { compact: 12, regular: 16, comfortable: 20 }[density] ?? 16;
  const isFirst = activeIdx <= 0;
  const isLast = activeIdx >= total - 1;

  return (
    <div
      style={{
        margin: `0 ${D}px 14px`,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 8,
      }}
    >
      <NavButton t={t} disabled={isFirst} onClick={onPrev} ariaLabel="Exercício anterior">
        ← Anterior
      </NavButton>

      <button
        type="button"
        onClick={onOpenList}
        aria-label="Visão geral dos exercícios"
        style={{
          height: 42,
          padding: '0 14px',
          borderRadius: t.radiusSm,
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          color: t.ink,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        <ListIcon color={t.inkMuted} />
        {activeIdx + 1}/{total}
      </button>

      <NavButton t={t} disabled={isLast} onClick={onNext} ariaLabel="Próximo / pular exercício">
        Próximo →
      </NavButton>
    </div>
  );
}

function NavButton({
  t,
  disabled,
  onClick,
  children,
  ariaLabel,
}: {
  t: Theme;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        height: 42,
        borderRadius: t.radiusSm,
        background: disabled ? t.surfaceMuted : t.surface,
        border: `0.5px solid ${t.border}`,
        color: disabled ? t.inkSubtle : t.ink,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ListIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill={color} />
      <circle cx="4" cy="12" r="1" fill={color} />
      <circle cx="4" cy="18" r="1" fill={color} />
    </svg>
  );
}
