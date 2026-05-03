import { useSearchParams } from 'react-router-dom';
import { WorkoutScreen } from '@/components/workout/WorkoutScreen';
import { PhoneFrame } from '@/components/workout/PhoneFrame';
import { useTheme } from '@/contexts/ThemeContext';
import type { WorkoutVariant } from '@/components/workout/types';
import type { DensityName } from '@/themes/tokens';

const VARIANTS: WorkoutVariant[] = ['start', 'in-progress', 'set-saved', 'new-pr', 'offline'];
const VARIANT_LABEL: Record<WorkoutVariant, string> = {
  start: 'Início (vazio)',
  'in-progress': 'Em execução',
  'set-saved': 'Série salva',
  'new-pr': 'Novo RP 🏆',
  offline: 'Offline (fila)',
};

const DENSITIES: DensityName[] = ['compact', 'regular', 'comfortable'];

function isVariant(v: string | null): v is WorkoutVariant {
  return v !== null && (VARIANTS as string[]).includes(v);
}

function isDensity(d: string | null): d is DensityName {
  return d !== null && (DENSITIES as string[]).includes(d);
}

export default function AlunoTreino() {
  const [params, setParams] = useSearchParams();
  const { theme, toggle } = useTheme();

  const variantParam = params.get('variant');
  const densityParam = params.get('density');
  const variant: WorkoutVariant = isVariant(variantParam) ? variantParam : 'in-progress';
  const density: DensityName = isDensity(densityParam) ? densityParam : 'regular';

  const setVariant = (v: WorkoutVariant) => {
    const next = new URLSearchParams(params);
    next.set('variant', v);
    setParams(next, { replace: true });
  };

  const setDensity = (d: DensityName) => {
    const next = new URLSearchParams(params);
    next.set('density', d);
    setParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <DemoBar
        variant={variant}
        density={density}
        theme={theme}
        onVariant={setVariant}
        onDensity={setDensity}
        onTheme={toggle}
      />
      <PhoneFrame dark={theme === 'dark'}>
        <WorkoutScreen theme={theme} variant={variant} density={density} />
      </PhoneFrame>
    </div>
  );
}

function DemoBar({
  variant,
  density,
  theme,
  onVariant,
  onDensity,
  onTheme,
}: {
  variant: WorkoutVariant;
  density: DensityName;
  theme: 'light' | 'dark';
  onVariant: (v: WorkoutVariant) => void;
  onDensity: (d: DensityName) => void;
  onTheme: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 backdrop-blur bg-surface/80 border-b border-app px-4 py-3 flex flex-wrap items-center gap-3 text-[11px]">
      <span className="text-mono uppercase tracking-wider text-ink-subtle font-semibold">
        Demo S3 · Execução
      </span>

      <div className="flex gap-1">
        {VARIANTS.map((v) => (
          <button
            key={v}
            onClick={() => onVariant(v)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
              variant === v
                ? 'bg-ink text-bg'
                : 'bg-surface-muted text-ink-muted hover:text-ink'
            }`}
          >
            {VARIANT_LABEL[v]}
          </button>
        ))}
      </div>

      <div className="flex gap-1 ml-auto">
        {DENSITIES.map((d) => (
          <button
            key={d}
            onClick={() => onDensity(d)}
            className={`px-2.5 py-1 rounded-full font-semibold capitalize ${
              density === d ? 'bg-ink text-bg' : 'bg-surface-muted text-ink-muted'
            }`}
          >
            {d}
          </button>
        ))}
        <button
          onClick={onTheme}
          className="px-2.5 py-1 rounded-full font-semibold bg-accent text-accent-ink"
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  );
}
