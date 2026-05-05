import { DENSITY } from '@/themes/tokens';
import { IconClock } from './icons';
import { VideoPlayer } from './VideoPlayer';
import type { WithTheme, WithDensity } from './types';

type Props = WithTheme & WithDensity & {
  restTimer: number;
  exerciseIndex?: number;
  exerciseTotal?: number;
  exerciseName?: string;
  /** URL do vídeo (YouTube, Vimeo ou arquivo nativo). Usa placeholder quando ausente. */
  videoUrl?: string | null;
  videoDuration?: string;
  series?: string;
  cargaAlvo?: string;
  pctRP?: string;
  descansoSeg?: number;
};

export function ExerciseCard({
  t,
  density,
  restTimer,
  exerciseIndex = 2,
  exerciseTotal = 6,
  exerciseName = 'Supino Inclinado\ncom Halteres',
  videoUrl,
  videoDuration = '0:42',
  series = '3 × 12',
  cargaAlvo = '32kg',
  pctRP = '70% RP',
  descansoSeg = 120,
}: Props) {
  const D = DENSITY[density];
  return (
    <div
      style={{
        margin: `0 ${D.pad}px ${D.gap}px`,
        borderRadius: t.radiusLg,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        boxShadow: t.cardShadow,
        overflow: 'hidden',
      }}
    >
      {/* Vídeo: iframe responsivo (YouTube/Vimeo) ou <video> nativo (mp4/webm).
         O componente preserva o aspect-ratio 16/10 do design e os cantos
         arredondados em qualquer viewport mobile. */}
      <div style={{ position: 'relative' }}>
        <VideoPlayer
          url={videoUrl}
          badge={videoUrl ? `vídeo · ${videoDuration}` : undefined}
          placeholderStripeBg={t.videoBg}
          placeholderStripeFg={t.videoStripe}
          rounded={0}            // bordas só no card; player encaixa flush
          aspectRatio="16 / 10"
        />
        {/* Pílula de descanso preservada por cima do player */}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 9px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.55)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            pointerEvents: 'none',
          }}
        >
          <IconClock color="#fff" />
          Descanso {restTimer}s
        </div>
      </div>
      <div style={{ padding: `${D.pad}px ${D.pad}px 14px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span
            style={{
              fontFamily: t.monoFont,
              fontSize: 10,
              fontWeight: 600,
              color: t.inkSubtle,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Exercício {String(exerciseIndex).padStart(2, '0')} · de {String(exerciseTotal).padStart(2, '0')}
          </span>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.4,
            lineHeight: 1.1,
            marginBottom: 10,
            whiteSpace: 'pre-line',
          }}
        >
          {exerciseName}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0,
            borderTop: `0.5px solid ${t.border}`,
            paddingTop: 12,
          }}
        >
          <Stat t={t} label="Séries" value={series} />
          <Stat t={t} label="Carga alvo" value={cargaAlvo} sub={pctRP} />
          <Stat t={t} label="Descanso" value={`${descansoSeg}s`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ t, label, value, sub }: WithTheme & { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          color: t.inkSubtle,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: t.monoFont,
          fontSize: 16,
          fontWeight: 600,
          color: t.ink,
          letterSpacing: -0.3,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: t.inkMuted, marginTop: 3, fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}
