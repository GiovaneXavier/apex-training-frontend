import { DENSITY } from '@/themes/tokens';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & { current: number; total: number };

export function ProgressStrip({ t, current, total, density }: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        padding: `0 ${D.pad}px ${D.gap}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i < current ? t.success : i === current ? t.accent : t.border,
            }}
          />
        ))}
      </div>
      <div
        style={{
          fontFamily: t.monoFont,
          fontSize: 11,
          color: t.inkMuted,
          letterSpacing: 0.4,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {String(current + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
      </div>
    </div>
  );
}
