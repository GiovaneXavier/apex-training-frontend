import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadFoto } from '@/lib/upload';

// ─────────────────────────────────────────────────────────────
// Slider Before/After deslizante (drag horizontal de uma barra
// vertical no meio da imagem). Mobile-first com Pointer Events
// — funciona com mouse e toque, sem dep de framer-motion.
// ─────────────────────────────────────────────────────────────
type CompareProps = {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  initialPct?: number;
  className?: string;
};

export function ImageComparisonSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  initialPct = 50,
  className,
}: CompareProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(initialPct);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, raw)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  // Suporte teclado para acessibilidade
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPct((p) => Math.max(0, p - 5));
    if (e.key === 'ArrowRight') setPct((p) => Math.min(100, p + 5));
    if (e.key === 'Home') setPct(0);
    if (e.key === 'End') setPct(100);
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl bg-surface-muted aspect-[3/4] select-none touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Comparação antes e depois — arraste para revelar"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {/* Foto AFTER ocupa o fundo inteiro */}
        <img
          src={afterUrl}
          alt={afterLabel}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        {/* Foto BEFORE limitada por clip-path conforme pct */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt={beforeLabel}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Labels */}
        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] uppercase tracking-wider font-bold pointer-events-none">
          {beforeLabel}
        </span>
        <span
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-white text-[10px] uppercase tracking-wider font-bold pointer-events-none"
          style={{ backgroundColor: '#fc4c02' }}
        >
          {afterLabel}
        </span>

        {/* Linha + handle */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_12px_rgba(0,0,0,0.45)] pointer-events-none"
          style={{ left: `${pct}%`, transform: 'translateX(-1px)' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-10 rounded-full bg-white shadow-lg flex items-center justify-center pointer-events-none"
          style={{ left: `${pct}%` }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6-6 6 6 6M15 6l6 6-6 6" />
          </svg>
        </div>
      </div>

      {/* Slider acessível embaixo (sincronizado) */}
      <div className="mt-3 px-1">
        <Slider value={[pct]} min={0} max={100} step={1} onValueChange={(v) => setPct(v[0] ?? 50)} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Uploader de fotos de progresso — 3 slots (Frente / Lado / Costas)
// ─────────────────────────────────────────────────────────────
export type FotosProgresso = {
  frente?: string;
  lado?: string;
  costas?: string;
};

type Slot = keyof FotosProgresso;

type UploaderProps = {
  value: FotosProgresso;
  onChange: (v: FotosProgresso) => void;
  className?: string;
};

const SLOTS: { key: Slot; label: string }[] = [
  { key: 'frente', label: 'Frente' },
  { key: 'lado', label: 'Lado' },
  { key: 'costas', label: 'Costas' },
];

export function FotosUploader({ value, onChange, className }: UploaderProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Fotos de progresso</CardTitle>
        <CardDescription>
          Tire as 3 fotos no mesmo horário e iluminação para a comparação ficar precisa.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {SLOTS.map((s) => (
            <FotoSlot
              key={s.key}
              label={s.label}
              url={value[s.key]}
              onUploaded={(url) => onChange({ ...value, [s.key]: url })}
              onRemover={() => {
                const next = { ...value };
                delete next[s.key];
                onChange(next);
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FotoSlot({
  label, url, onUploaded, onRemover,
}: {
  label: string;
  url?: string;
  onUploaded: (url: string) => void;
  onRemover: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup de blobs/data URLs antigos quando trocar
  useEffect(() => {
    return () => {
      // data URL não precisa revoke, blob URL precisa
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function onPick(file: File) {
    setError(null);
    setLoading(true);
    try {
      const { url: novoUrl } = await uploadFoto(file);
      onUploaded(novoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className={cn(
          'relative aspect-[2/3] w-full rounded-xl overflow-hidden',
          'border-2 border-dashed border-app-strong',
          'bg-surface-muted hover:bg-surface',
          'flex flex-col items-center justify-center gap-1',
          'transition-colors',
          url && 'border-solid border-app',
          loading && 'opacity-60 cursor-wait',
        )}
      >
        {url ? (
          <>
            <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full bg-black/55 text-white text-[9px] uppercase tracking-wider font-bold">
              {label}
            </span>
          </>
        ) : (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-subtle">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</span>
          </>
        )}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center bg-bg/70 text-[10px] uppercase tracking-wider font-bold text-ink">
            Enviando…
          </span>
        )}
      </button>

      {url && !loading && (
        <button
          type="button"
          onClick={onRemover}
          className="text-[10px] uppercase tracking-wider font-bold text-danger mt-1 w-full text-center"
        >
          remover
        </button>
      )}

      {error && (
        <div className="text-[10px] text-danger font-medium mt-1">{error}</div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
