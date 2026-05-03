import { DENSITY } from '@/themes/tokens';
import { IconCheck } from './icons';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & {
  label?: string;
  enabled?: boolean;
  dim?: boolean;
  onSkip?: () => void;
  onSave?: () => void;
};

export function SaveBar({
  t,
  density,
  label = 'Salvar série',
  enabled = true,
  dim = false,
  onSkip,
  onSave,
}: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        margin: `0 ${D.pad}px ${D.gap}px`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}
    >
      <button
        onClick={onSkip}
        style={{
          height: 46,
          borderRadius: t.radiusSm,
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          color: t.inkMuted,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Pular
      </button>
      <button
        onClick={enabled ? onSave : undefined}
        style={{
          height: 46,
          borderRadius: t.radiusSm,
          background: enabled ? t.accent : t.surfaceMuted,
          border: `0.5px solid ${enabled ? t.accent : t.border}`,
          color: enabled ? t.accentInk : t.inkSubtle,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: enabled ? 'pointer' : 'default',
          opacity: dim ? 0.5 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <IconCheck color={enabled ? t.accentInk : t.inkSubtle} size={14} />
        {label}
      </button>
    </div>
  );
}
