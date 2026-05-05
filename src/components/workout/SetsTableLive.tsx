import { DENSITY } from '@/themes/tokens';
import { IconCheck, IconTrophy } from './icons';
import type { WithTheme, WithDensity } from './types';
import type { ExecExercicio } from '@/hooks/useExecucaoTreino';

type Props = WithTheme & WithDensity & {
  exercicio: ExecExercicio;
  activeSetIdx: number;
  prSetIdxs?: number[];
};

// Versão da SetsTable que renderiza estado real (prescrito + realizado).
// Sem inputs inline — coleta via SaveSerieBar separada.
export function SetsTableLive({ t, density, exercicio, activeSetIdx, prSetIdxs = [] }: Props) {
  const D = DENSITY[density];
  const series = Array.from({ length: exercicio.series }).map((_, i) => {
    const r = exercicio.realizado[i];
    return {
      kg: r?.kg !== undefined ? String(r.kg) : undefined,
      reps: r?.reps !== undefined ? String(r.reps) : undefined,
      hint: hintForSet(exercicio),
      done: r !== undefined,
      pr: prSetIdxs.includes(i),
    };
  });

  return (
    <div
      style={{
        margin: `0 ${D.pad}px ${D.gap}px`,
        borderRadius: t.radius,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 1fr 36px',
          padding: '10px 14px',
          gap: 8,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.6,
          color: t.inkSubtle,
          textTransform: 'uppercase',
          borderBottom: `0.5px solid ${t.border}`,
        }}
      >
        <div>#</div>
        <div>Carga (kg)</div>
        <div>Reps</div>
        <div></div>
      </div>
      {series.map((s, i) => {
        const isActive = i === activeSetIdx && !s.done;
        const isDone = s.done;
        const isPR = s.pr;
        const bg = isPR ? t.prBg : isDone ? t.successBg : t.surface;
        const cellInk = isPR ? t.pr : isDone ? t.successInk : t.ink;
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 1fr 36px',
              padding: '10px 14px',
              gap: 8,
              alignItems: 'center',
              background: bg,
              borderBottom: i < series.length - 1 ? `0.5px solid ${t.border}` : 'none',
              position: 'relative',
            }}
          >
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 2.5,
                  background: t.accent,
                  borderRadius: 2,
                }}
              />
            )}
            <div
              style={{
                fontFamily: t.monoFont,
                fontSize: 13,
                fontWeight: 600,
                color: isActive ? t.accent : t.inkMuted,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </div>
            <Cell t={t} value={s.kg} placeholder={s.hint.kg} active={isActive && !s.kg} cellInk={cellInk} unit="kg" />
            <Cell t={t} value={s.reps} placeholder={s.hint.reps} active={isActive && !!s.kg && !s.reps} cellInk={cellInk} unit="reps" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {isPR ? (
                <span
                  style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: t.pr, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconTrophy color={t.accentInk} />
                </span>
              ) : isDone ? (
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 999,
                    background: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconCheck color={t.surface} size={12} />
                </span>
              ) : (
                <span
                  style={{
                    width: 22, height: 22, borderRadius: 999,
                    border: `1px dashed ${t.borderStrong}`,
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function hintForSet(ex: ExecExercicio) {
  // Hint baseado em prescrito (cargaKg ou cargaPctRP em kg estimado quando há base, fallback "— —")
  let kgHint = '— —';
  if (ex.cargaKg) kgHint = String(ex.cargaKg);
  return {
    kg: kgHint,
    reps: ex.reps ? String(ex.reps) : '— —',
  };
}

type CellProps = WithTheme & {
  value?: string;
  placeholder?: string;
  active: boolean;
  cellInk: string;
  unit: string;
};

function Cell({ t, value, placeholder, active, cellInk, unit }: CellProps) {
  const isEmpty = !value;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        fontFamily: t.monoFont,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        style={{
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: -0.3,
          color: isEmpty ? t.inkSubtle : cellInk,
          opacity: isEmpty ? 0.7 : 1,
          position: 'relative',
        }}
      >
        {isEmpty ? placeholder : value}
        {active && isEmpty && (
          <span
            style={{
              display: 'inline-block',
              width: 1.5,
              height: 16,
              background: t.accent,
              marginLeft: 1,
              verticalAlign: -2,
              animation: 'wsBlink 1s steps(2,start) infinite',
            }}
          />
        )}
      </span>
      {!isEmpty && <span style={{ fontSize: 10, color: t.inkSubtle, fontWeight: 500 }}>{unit}</span>}
    </div>
  );
}
