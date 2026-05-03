import { DENSITY } from '@/themes/tokens';
import { IconWifiOff } from './icons';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & { queueCount?: number };

export function OfflineBanner({ t, density, queueCount = 3 }: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        margin: `-4px ${D.pad}px ${D.gap}px`,
        padding: '10px 12px',
        borderRadius: t.radiusSm,
        background: t.warnBg,
        color: t.warn,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: `0.5px solid ${t.warn}33`,
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: t.warn,
          color: t.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconWifiOff color={t.bg} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.ink, marginBottom: 1 }}>
          Sem conexão · gravando localmente
        </div>
        <div style={{ fontSize: 11, color: t.inkMuted, fontWeight: 500 }}>
          {queueCount} séries na fila · sincronizam quando voltar
        </div>
      </div>
      <div
        style={{
          fontFamily: t.monoFont,
          fontSize: 11,
          fontWeight: 700,
          padding: '4px 8px',
          borderRadius: 6,
          background: t.warn,
          color: t.bg,
        }}
      >
        {queueCount}
      </div>
    </div>
  );
}
