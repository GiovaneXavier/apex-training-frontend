import { DENSITY } from '@/themes/tokens';
import { IconChevron } from './icons';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & { ghost?: boolean; onClick?: () => void };

export function FinalizeCTA({ t, density, ghost = false, onClick }: Props) {
  const D = DENSITY[density];
  return (
    <div style={{ margin: `${D.gap}px ${D.pad}px ${D.pad}px` }}>
      <button
        onClick={onClick}
        style={{
          width: '100%',
          height: 54,
          borderRadius: t.radius,
          background: ghost ? 'transparent' : t.ink,
          border: ghost ? `0.5px dashed ${t.borderStrong}` : `0.5px solid ${t.ink}`,
          color: ghost ? t.inkMuted : t.bg,
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        Finalizar Treino
        <IconChevron color={ghost ? t.inkMuted : t.bg} dir="right" />
      </button>
    </div>
  );
}
