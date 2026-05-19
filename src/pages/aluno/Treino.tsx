import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { WorkoutScreen } from '@/components/workout/WorkoutScreen';
import { WorkoutLive } from '@/components/workout/WorkoutLive';
import { PhoneFrame } from '@/components/workout/PhoneFrame';

// PR #15 (audit 5.16) — lazy load por modalidade. Cada Live carrega
// dependências pesadas (Strava client em CorridaLive, matemática de
// CSS em NatacaoLive, cronômetros em HyroxLive). Sem split, todos
// caem no chunk de Treino — atleta que abriu pra fazer musculação
// pagava o byte das outras 4 modalidades.
const CorridaLive = lazy(() =>
  import('@/components/workout/CorridaLive').then((m) => ({ default: m.CorridaLive })),
);
const CiclismoLive = lazy(() =>
  import('@/components/workout/CiclismoLive').then((m) => ({ default: m.CiclismoLive })),
);
const NatacaoLive = lazy(() =>
  import('@/components/workout/NatacaoLive').then((m) => ({ default: m.NatacaoLive })),
);
const HyroxLive = lazy(() =>
  import('@/components/workout/HyroxLive').then((m) => ({ default: m.HyroxLive })),
);
const JiuJitsuLive = lazy(() =>
  import('@/components/workout/JiuJitsuLive').then((m) => ({ default: m.JiuJitsuLive })),
);

// Fallback inline — placeholder magro pra evitar criar chunk extra.
// Tempo real de carga em 4G geralmente fica abaixo de 500ms (Live
// components têm 30-80KB cada).
function LiveFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink-muted/30 border-t-coral" />
    </div>
  );
}
import { ReagendarButton } from '@/components/ReagendarButton';
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
    const ctrl = new AbortController();
    setLoading(true);
    getTreino(id, { signal: ctrl.signal })
      .then((t) => { if (!ctrl.signal.aborted) setTreino(t); })
      .catch((err) => { if (!ctrl.signal.aborted) setError(apiErrorMessage(err)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
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
  // Sem PhoneFrame — fullscreen em qualquer viewport. Frame só no modo demo.
  if (!isDemo && treino && treino.detalhes.tipo === 'musculacao') {
    return (
      <div
        className="bg-bg text-ink"
        style={{ height: '100dvh', width: '100%', overflow: 'hidden' }}
      >
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        {/* Centraliza no desktop limitando a 480px; mobile ocupa 100% */}
        <div style={{ maxWidth: 480, height: '100%', margin: '0 auto', position: 'relative' }}>
          <WorkoutLive treino={treino} theme={theme} density={density} />
        </div>
      </div>
    );
  }

  // Treino real: corrida → CorridaLive (form de log + import Strava)
  if (!isDemo && treino && treino.detalhes.tipo === 'corrida') {
    return (
      <>
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        <Suspense fallback={<LiveFallback />}>
          <CorridaLive treino={treino} alunoId={alunoIdAtual} />
        </Suspense>
      </>
    );
  }

  // Treino real: ciclismo → CiclismoLive (zonas FTP + blocos com check)
  if (!isDemo && treino && treino.detalhes.tipo === 'ciclismo') {
    return (
      <>
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        <Suspense fallback={<LiveFallback />}>
          <CiclismoLive treino={treino} />
        </Suspense>
      </>
    );
  }

  // Treino real: natação → NatacaoLive (CSS + séries com RI/Send-off)
  if (!isDemo && treino && treino.detalhes.tipo === 'natacao') {
    return (
      <>
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        <Suspense fallback={<LiveFallback />}>
          <NatacaoLive treino={treino} />
        </Suspense>
      </>
    );
  }

  // Treino real: hyrox → HyroxLive (checklist + cronômetro AMRAP/EMOM)
  if (!isDemo && treino && treino.detalhes.tipo === 'hyrox') {
    return (
      <>
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        <Suspense fallback={<LiveFallback />}>
          <HyroxLive treino={treino} />
        </Suspense>
      </>
    );
  }

  // Treino real: jiu-jitsu → JiuJitsuLive (diário pós-rola, PR #23)
  if (!isDemo && treino && treino.detalhes.tipo === 'jiu_jitsu') {
    return (
      <>
        {treino.status !== 'CONCLUIDO' && treino.status !== 'PULADO' && (
          <ReagendarButton
            treinoId={treino.id}
            dataAtual={treino.dataAlvo}
            onReagendado={(iso) => setTreino({ ...treino, dataAlvo: iso })}
          />
        )}
        <Suspense fallback={<LiveFallback />}>
          <JiuJitsuLive treino={treino} />
        </Suspense>
      </>
    );
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
