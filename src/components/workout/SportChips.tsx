import { DENSITY } from '@/themes/tokens';
import { IconDumbbell, IconRunner, IconSwim } from './icons';
import type { WithTheme, WithDensity, SportKey } from './types';

type SportMeta = { label: string; icon: (p: { color: string }) => JSX.Element; active: boolean };

const SPORT_MAP: Record<SportKey, SportMeta> = {
  musc: { label: 'Musculação', icon: IconDumbbell, active: true },
  run: { label: 'Corrida 5km', icon: IconRunner, active: false },
  swim: { label: 'Natação', icon: IconSwim, active: false },
};

type Props = WithTheme & WithDensity & { items: SportKey[] };

export function SportChips({ t, density, items }: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        padding: `0 ${D.pad}px ${D.gap}px`,
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
      }}
    >
      {items.map((k) => {
        const it = SPORT_MAP[k];
        const Ic = it.icon;
        const active = it.active;
        return (
          <div
            key={k}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 999,
              background: active ? t.ink : t.surface,
              color: active ? t.bg : t.inkMuted,
              border: `0.5px solid ${active ? t.ink : t.border}`,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.1,
              whiteSpace: 'nowrap',
            }}
          >
            <Ic color={active ? t.bg : t.inkMuted} />
            {it.label}
            {active && <span style={{ opacity: 0.6, fontWeight: 500 }}>· em curso</span>}
          </div>
        );
      })}
    </div>
  );
}
