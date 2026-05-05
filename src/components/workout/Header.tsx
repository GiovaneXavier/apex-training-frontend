import { DENSITY } from '@/themes/tokens';
import { IconBack, IconWifi, IconWifiOff } from './icons';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & {
  online: boolean;
  date?: string;
  title?: string;
  onBack?: () => void;
};

export function Header({ t, density, online, date = 'Quarta · 12 nov', title = 'Treino A · Superiores', onBack }: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        padding: `${D.pad}px ${D.pad}px ${D.headerPb}px`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
      }}
    >
      <button
        onClick={onBack}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          cursor: 'pointer',
          boxShadow: t.cardShadow,
        }}
      >
        <IconBack color={t.ink} />
      </button>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            color: t.inkSubtle,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {date}
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.3,
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 10px',
          borderRadius: 999,
          background: online ? t.successBg : t.dangerBg,
          color: online ? t.successInk : t.danger,
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {online ? <IconWifi color={t.successInk} /> : <IconWifiOff color={t.danger} />}
        {online ? 'Online' : 'Offline'}
      </div>
    </div>
  );
}
