import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { WorkoutScreen } from '@/components/workout/WorkoutScreen';
import { WorkoutLive } from '@/components/workout/WorkoutLive';
import { CorridaLive } from '@/components/workout/CorridaLive';
import { PhoneFrame } from '@/components/workout/PhoneFrame';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getTreino } from '@/lib/api/treinos';
import { apiErrorMessage } from '@/lib/api';
import type { WorkoutVariant } from '@/components/workout/types';
import type { DensityName } from '@/themes/tokens';
import type { Treino } from '@/types/treino';

const VARIANTS: WorkoutVariant[] = ['start', 'in-progress', 'set-saved', 'new-pr', 'offline'];
const VARIANT_LABEL: Record<WorkoutVariant, string> = {
  start: 'Início',
  'in-progress': 'Em execução',
  'set-saved': 'Série salva',
  'new-pr': 'Novo RP',
  offline: 'Offline',
};
const DENSITIES: DensityName[] = ['compact', 'regular', 'comfortable'];

function isVariant(v: string | null): v is WorkoutVariant {
  return v !== null && (VARIANTS as string[]).includes(v);
}
function isDensity(d: string | null): d is DensityName {
  return d !== null && (DENSITIES as string[]).includes(d);
}

export default function AlunoTreino() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const alunoIdAtual = user?.aluno?.id;

  const variantParam = params.get('variant');
  const densityParam = params.get('density');
  const variant: WorkoutVariant = isVariant(variantParam) ? variantParam : 'in-progress';
  const density: DensityName = isDensity(densityParam) ? densityParam : 'regular';

  const isDemo = id === 'demo';
  const [treino, setTreino] = useState<Treino | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (isDemo || !id) return;
    let cancelled = false;
    setLoading(true);
    getTreino(id)
      .then((t) => !cancelled && setTreino(t))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
  }, [id, isDemo]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-ink-muted text-mono text-sm uppercase tracking-wider">
        carregando treino...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
        <div className="text-3xl mb-3">⚠️</div>
        <div className="text-ink font-semibold mb-1">Não foi possível carregar</div>
        <div className="text-ink-muted text-sm mb-5">{error}</div>
        <Link to="/aluno/dashboard" className="text-mono text-[12px] uppercase tracking-wider font-bold text-accent">
          ← Voltar ao dashboard
        </Link>
      </div>
    );
  }

  // Treino real: musculação → WorkoutLive (execução real com offline-first + RP)
  if (!isDemo && treino && treino.detalhes.tipo === 'musculacao') {
    return (
      <div className="min-h-screen bg-bg text-ink">
        <PhoneFrame dark={theme === 'dark'}>
          <WorkoutLive treino={treino} theme={theme} density={density} />
        </PhoneFrame>
      </div>
    );
  }

  // Treino real: corrida → CorridaLive (form de log + import Strava)
  if (!isDemo && treino && treino.detalhes.tipo === 'corrida') {
    return <CorridaLive treino={treino} alunoId={alunoIdAtual} />;
  }

  // Treino real: outras modalidades → placeholder
  if (!isDemo && treino) {
    return (
      <div className="min-h-screen bg-bg text-ink p-6">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
        <div className="mt-8 max-w-md">
          <h1 className="text-2xl font-bold tracking-tight mb-2">{treino.titulo}</h1>
          <p className="text-ink-muted text-sm mb-6">
            UI de execução para <b>{treino.detalhes.tipo}</b> chega num próximo sprint.
            Os dados estão prescritos e o treino aparece no calendário.
          </p>
          <pre className="text-mono text-[11px] bg-surface border border-app p-3 rounded-[10px] overflow-x-auto">
            {JSON.stringify(treino.detalhes, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Modo demo (id === 'demo'): DemoBar + WorkoutScreen com 5 variantes
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
      <Link to="/aluno/dashboard" className="text-mono uppercase tracking-wider text-ink-subtle font-bold">
        ← Dashboard
      </Link>
      <span className="text-mono uppercase tracking-wider text-accent font-bold">Demo</span>
      <div className="flex gap-1">
        {VARIANTS.map((v) => (
          <button
            key={v}
            onClick={() => onVariant(v)}
            className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
              variant === v ? 'bg-ink text-bg' : 'bg-surface-muted text-ink-muted hover:text-ink'
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
        <button onClick={onTheme} className="px-2.5 py-1 rounded-full font-semibold bg-accent text-accent-ink">
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>
    </div>
  );
}
