import { useMemo } from 'react';

// Detecta provider e extrai o ID do vídeo a partir de várias formas comuns
// de URL. Retorna `kind: 'placeholder'` quando não é possível tocar.
type ParsedVideo =
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string }
  | { kind: 'native'; url: string }       // mp4 / webm / ogg / mov direto
  | { kind: 'placeholder' };

const NATIVE_EXT = /\.(mp4|webm|ogg|mov)(\?.*)?$/i;

export function parseVideoUrl(url: string | null | undefined): ParsedVideo {
  if (!url) return { kind: 'placeholder' };
  const trimmed = url.trim();
  if (!trimmed) return { kind: 'placeholder' };

  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, '');

    // YouTube — formatos suportados: youtu.be/<id>, youtube.com/watch?v=<id>,
    // youtube.com/embed/<id>, youtube.com/shorts/<id>
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (id) return { kind: 'youtube', id };
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return { kind: 'youtube', id: v };
      const m = u.pathname.match(/\/(embed|shorts)\/([^/?#]+)/);
      if (m?.[2]) return { kind: 'youtube', id: m[2] };
    }

    // Vimeo: vimeo.com/<id> ou player.vimeo.com/video/<id>
    if (host === 'vimeo.com') {
      const m = u.pathname.match(/\/(\d+)/);
      if (m?.[1]) return { kind: 'vimeo', id: m[1] };
    }
    if (host === 'player.vimeo.com') {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m?.[1]) return { kind: 'vimeo', id: m[1] };
    }

    // Vídeo nativo por extensão
    if (NATIVE_EXT.test(u.pathname)) {
      return { kind: 'native', url: trimmed };
    }
  } catch {
    // URL inválida — pode ser caminho relativo. Trata como nativo.
    if (NATIVE_EXT.test(trimmed)) return { kind: 'native', url: trimmed };
  }

  return { kind: 'placeholder' };
}

type Props = {
  url: string | null | undefined;
  /** texto/tag opcional sobreposto no canto (ex: "vídeo · 0:42") */
  badge?: string;
  /** placeholder quando não há URL — mostra ícone play em listras */
  placeholderStripeBg?: string;
  placeholderStripeFg?: string;
  className?: string;
  /** rounded-2xl por padrão; aspectRatio 16/10 mantido visualmente */
  rounded?: number;
  aspectRatio?: string;
};

export function VideoPlayer({
  url, badge,
  placeholderStripeBg = '#f4f4f1',
  placeholderStripeFg = '#e8e8e2',
  className,
  rounded = 18,
  aspectRatio = '16 / 10',
}: Props) {
  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio,
    borderRadius: rounded,
    overflow: 'hidden',
    background: '#000',
  };

  if (parsed.kind === 'youtube') {
    return (
      <div style={containerStyle} className={className}>
        <iframe
          src={`https://www.youtube.com/embed/${parsed.id}?rel=0&modestbranding=1&playsinline=1`}
          title="Vídeo do exercício"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
        {badge && <Badge text={badge} />}
      </div>
    );
  }

  if (parsed.kind === 'vimeo') {
    return (
      <div style={containerStyle} className={className}>
        <iframe
          src={`https://player.vimeo.com/video/${parsed.id}?title=0&byline=0&portrait=0&playsinline=1`}
          title="Vídeo do exercício"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
        {badge && <Badge text={badge} />}
      </div>
    );
  }

  if (parsed.kind === 'native') {
    return (
      <div style={containerStyle} className={className}>
        <video
          src={parsed.url}
          controls
          playsInline
          preload="metadata"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {badge && <Badge text={badge} />}
      </div>
    );
  }

  // Placeholder (sem URL): listras + ícone de play.
  // Não dá impressão de carregamento — comunica "vídeo opcional não cadastrado".
  return (
    <div
      style={{
        ...containerStyle,
        background: `repeating-linear-gradient(135deg, ${placeholderStripeBg}, ${placeholderStripeBg} 12px, ${placeholderStripeFg} 12px, ${placeholderStripeFg} 24px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      className={className}
      aria-label="Sem vídeo de demonstração"
      role="img"
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 999,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          paddingLeft: 4,
          opacity: 0.6,
        }}
      >
        <svg width={22} height={22} viewBox="0 0 24 24" fill="#fff">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <Badge text="sem vídeo" />
    </div>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        fontFamily: 'monospace',
        fontSize: 9.5,
        color: 'rgba(255,255,255,0.9)',
        letterSpacing: 0.5,
        padding: '3px 7px',
        borderRadius: 4,
        background: 'rgba(0,0,0,0.55)',
        textTransform: 'uppercase',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  );
}
