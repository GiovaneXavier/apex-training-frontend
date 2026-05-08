import { useEffect } from 'react';
import { getTheme, type DensityName } from '@/themes/tokens';
import type { ExecExercicio } from '@/hooks/useExecucaoTreino';

type Theme = ReturnType<typeof getTheme>;

type Props = {
  t: Theme;
  density: DensityName;
  open: boolean;
  exercicios: ExecExercicio[];
  activeIdx: number;
  onSelect: (idx: number) => void;
  onClose: () => void;
};

// Bottom sheet com a lista completa de exercícios. Evita dep extra do
// Radix Dialog — o estilo já é totalmente inline em components/workout/*.
// Acessibilidade: role=dialog + aria-modal, ESC fecha, overlay click fecha.
export function ExerciseListSheet({
  t,
  density,
  open,
  exercicios,
  activeIdx,
  onSelect,
  onClose,
}: Props) {
  // ESC fecha — listener global enquanto aberto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // Trava scroll do body enquanto sheet aberto (evita rubber-band atrás)
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const D = { compact: 12, regular: 16, comfortable: 20 }[density] ?? 16;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visão geral dos exercícios"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* overlay clicável */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          animation: 'wsFadeIn 160ms ease-out',
        }}
      />

      {/* painel */}
      <div
        style={{
          position: 'relative',
          background: t.surface,
          color: t.ink,
          borderTopLeftRadius: t.radiusLg,
          borderTopRightRadius: t.radiusLg,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
          animation: 'wsSlideUp 200ms ease-out',
        }}
      >
        <style>{`
          @keyframes wsFadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes wsSlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        `}</style>

        {/* grab handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
          <span
            aria-hidden
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              background: t.borderStrong,
            }}
          />
        </div>

        {/* header */}
        <div
          style={{
            padding: `${D}px ${D}px 8px`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Exercícios</h2>
          <span style={{ fontSize: 12, color: t.inkMuted }}>
            {exercicios.length} no total
          </span>
        </div>

        {/* lista */}
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: `0 ${D}px ${D}px`,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {exercicios.map((ex, idx) => {
            const completo = ex.realizado.length >= ex.series;
            const isActive = idx === activeIdx;
            const seriesLabel = `${Math.min(ex.realizado.length, ex.series)}/${ex.series} séries`;

            return (
              <li key={`${ex.nome}-${idx}`} style={{ marginTop: idx === 0 ? 0 : 8 }}>
                <button
                  type="button"
                  onClick={() => onSelect(idx)}
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: t.radiusSm,
                    background: isActive ? t.surfaceMuted : 'transparent',
                    border: `0.5px solid ${isActive ? t.borderStrong : t.border}`,
                    color: t.ink,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    opacity: completo && !isActive ? 0.55 : 1,
                  }}
                >
                  <StatusBadge t={t} completo={completo} active={isActive} index={idx} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 600,
                        textDecoration: completo ? 'line-through' : 'none',
                        textDecorationColor: t.inkSubtle,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ex.nome}
                    </span>
                    <span style={{ display: 'block', fontSize: 11, color: t.inkMuted, marginTop: 2 }}>
                      {seriesLabel}
                      {ex.cargaKg ? ` · ${ex.cargaKg}kg` : ''}
                      {ex.reps ? ` × ${ex.reps}` : ''}
                    </span>
                  </span>
                  {isActive && <ChevronRight color={t.inkMuted} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function StatusBadge({
  t,
  completo,
  active,
  index,
}: {
  t: Theme;
  completo: boolean;
  active: boolean;
  index: number;
}) {
  // 3 estados: completo (check verde) · ativo (accent) · pendente (número)
  const size = 28;
  const bg = completo ? t.successBg : active ? t.accent : t.surfaceMuted;
  const fg = completo ? t.successInk : active ? t.accentInk : t.inkMuted;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: fg,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {completo ? <CheckIcon /> : index + 1}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
