import type { WithTheme } from './types';

type Props = WithTheme & {
  message?: string;
  achievement?: { atual: string; anterior: string; diasAtras: number };
  onContinue?: () => void;
  onShare?: () => void;
};

export function PRCelebration({
  t,
  message = '+4kg no supino',
  achievement = { atual: '36kg × 12', anterior: '32kg × 12', diasAtras: 18 },
  onContinue,
  onShare,
}: Props) {
  const burst = (i: number) => {
    const a = (i / 12) * Math.PI * 2;
    const r = 110;
    return {
      left: '50%',
      top: '50%',
      transform: `translate(-50%,-50%) translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px) rotate(${(a * 180) / Math.PI + 90}deg)`,
    };
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: t.bg === '#fafaf9' ? 'rgba(250,250,249,0.86)' : 'rgba(10,10,11,0.86)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', width: 220, height: 220, marginBottom: 18 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 2.5,
              height: 18,
              borderRadius: 2,
              background: i % 3 === 0 ? t.accent : i % 3 === 1 ? t.success : t.pr,
              opacity: 0.85,
              ...burst(i),
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 130,
            height: 130,
            borderRadius: 999,
            background: t.pr,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 12px 40px ${t.pr}55`,
          }}
        >
          <svg width="58" height="58" viewBox="0 0 16 16" fill="none">
            <path d="M4 3h8v3a4 4 0 11-8 0V3z" fill={t.accentInk} />
            <path
              d="M4 4H2v1.5A2 2 0 004 7.5M12 4h2v1.5a2 2 0 01-2 2M6.5 11h3v2H11v1H5v-1h1.5v-2z"
              stroke={t.accentInk}
              strokeWidth="1"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
      <div
        style={{
          fontFamily: t.monoFont,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: t.pr,
          marginBottom: 6,
          textTransform: 'uppercase',
        }}
      >
        Novo Recorde Pessoal
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: t.ink,
          letterSpacing: -0.6,
          lineHeight: 1,
          marginBottom: 8,
        }}
      >
        {message}
      </div>
      <div style={{ fontSize: 13, color: t.inkMuted, fontWeight: 500, marginBottom: 18, maxWidth: 240 }}>
        Você bateu <b style={{ color: t.ink }}>{achievement.atual}</b>. Antes: {achievement.anterior} (há{' '}
        {achievement.diasAtras} dias).
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onShare}
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: t.radiusSm,
            background: 'transparent',
            border: `0.5px solid ${t.border}`,
            color: t.inkMuted,
            fontWeight: 600,
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Compartilhar
        </button>
        <button
          onClick={onContinue}
          style={{
            height: 42,
            padding: '0 18px',
            borderRadius: t.radiusSm,
            background: t.ink,
            border: 'none',
            color: t.bg,
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
