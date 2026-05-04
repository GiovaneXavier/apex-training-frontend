import { useEffect, useState } from 'react';

import { DENSITY } from '@/themes/tokens';
import { IconCheck } from './icons';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & {
  serieNumero: number;
  totalSeries: number;
  cargaSugerida?: number;
  repsSugeridas?: number;
  disabled?: boolean;
  onSalvar: (kg: number, reps: number) => void;
  onPular?: () => void;
};

export function SaveSerieBar({
  t,
  density,
  serieNumero,
  totalSeries,
  cargaSugerida,
  repsSugeridas,
  disabled,
  onSalvar,
  onPular,
}: Props) {
  const D = DENSITY[density];
  const [kg, setKg] = useState<string>('');
  const [reps, setReps] = useState<string>('');

  // Reset campos ao trocar de série
  useEffect(() => {
    setKg('');
    setReps('');
  }, [serieNumero]);

  const valid = Number(kg) > 0 && Number(reps) > 0;

  return (
    <div
      style={{
        margin: `0 ${D.pad}px ${D.gap}px`,
        padding: 12,
        borderRadius: t.radius,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        boxShadow: t.cardShadow,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: t.monoFont,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: t.inkSubtle,
            textTransform: 'uppercase',
          }}
        >
          Próxima série · {String(serieNumero).padStart(2, '0')}/{String(totalSeries).padStart(2, '0')}
        </span>
        {(cargaSugerida || repsSugeridas) && (
          <span style={{ fontSize: 11, color: t.inkMuted, fontWeight: 500 }}>
            sugerido: {cargaSugerida ?? '—'}kg × {repsSugeridas ?? '—'}
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <NumberField
          t={t}
          label="Carga (kg)"
          value={kg}
          placeholder={cargaSugerida ? String(cargaSugerida) : '0'}
          onChange={setKg}
        />
        <NumberField
          t={t}
          label="Reps"
          value={reps}
          placeholder={repsSugeridas ? String(repsSugeridas) : '0'}
          onChange={setReps}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          onClick={onPular}
          disabled={disabled}
          style={{
            height: 46,
            borderRadius: t.radiusSm,
            background: t.surfaceMuted,
            border: `0.5px solid ${t.border}`,
            color: t.inkMuted,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          Pular
        </button>
        <button
          disabled={!valid || disabled}
          onClick={() => valid && onSalvar(Number(kg), Number(reps))}
          style={{
            height: 46,
            borderRadius: t.radiusSm,
            background: valid && !disabled ? t.accent : t.surfaceMuted,
            border: `0.5px solid ${valid && !disabled ? t.accent : t.border}`,
            color: valid && !disabled ? t.accentInk : t.inkSubtle,
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: valid && !disabled ? 'pointer' : 'default',
            opacity: disabled ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <IconCheck color={valid && !disabled ? t.accentInk : t.inkSubtle} size={14} />
          Salvar série
        </button>
      </div>
    </div>
  );
}

function NumberField({
  t,
  label,
  value,
  placeholder,
  onChange,
}: WithTheme & {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.6,
          color: t.inkSubtle,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      <input
        inputMode="decimal"
        type="number"
        step="0.5"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 44,
          padding: '0 12px',
          borderRadius: t.radiusSm,
          background: t.bg,
          border: `0.5px solid ${t.borderStrong}`,
          color: t.ink,
          fontFamily: t.monoFont,
          fontSize: 18,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          outline: 'none',
        }}
      />
    </label>
  );
}
