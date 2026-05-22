import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiErrorMessage } from '@/lib/api';
import { getDesempenho, type Desempenho, type EstimativaProva } from '@/lib/api/desempenho';
import { useAuth } from '@/contexts/AuthContext';

import { CORAL, CORAL_DARK, FlameIcon, ResumoCardSimples } from './shared';

// PR #33 — Secao Desempenho extraída pra lazy chunk próprio.
//
// OTIMIZAÇÃO AGRESSIVA: NÃO importa Recharts diretamente. Donut do ciclo
// usa SVG puro (geometricamente trivial — 1 arco). GraficoVolume é o
// único componente Recharts-pesado, e ele entra via lazy() → chunk
// próprio. Resultado: aluno abre tab Desempenho e vê streak + ciclo +
// estimativas imediatamente; gráfico de volume aparece com fallback
// enquanto o chunk Recharts baixa em background.
//
// SecaoEvolucao mantém Recharts (LineChart) — quando atleta clica aquela
// tab, Recharts já pode estar em cache do click no GraficoVolume aqui.

const GraficoVolume = lazy(() =>
  import('@/components/aluno/GraficoVolume').then((m) => ({ default: m.GraficoVolume })),
);

function GraficoVolumeFallback() {
  return (
    <Card>
      <CardContent className="p-6 text-center text-ink-muted text-[12px]">
        Carregando matriz de volume…
      </CardContent>
    </Card>
  );
}

export function SecaoDesempenho() {
  const { user } = useAuth();
  const [data, setData] = useState<Desempenho | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const ctrl = new AbortController();
    setLoading(true);
    getDesempenho(undefined, { signal: ctrl.signal })
      .then((d) => { if (!ctrl.signal.aborted) setData(d); })
      .catch((err) => { if (!ctrl.signal.aborted) setError(apiErrorMessage(err)); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [user]);

  if (loading) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center text-ink-muted text-[13px]">
          Carregando desempenho…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-2">
        <CardContent className="p-6 text-center">
          <div className="text-danger text-[13px] font-medium">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <CardStreak semanas={data.streak} />
      <Suspense fallback={<GraficoVolumeFallback />}>
        <GraficoVolume />
      </Suspense>
      <CardCiclo ciclo={data.ciclo} />
      <CardEstimativas estimativas={data.estimativasProva} />
      <CardResumoMes resumo={data.resumoMes} />
    </div>
  );
}

function CardStreak({ semanas }: { semanas: number }) {
  return (
    <Card
      className="border-0 text-white relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${CORAL_DARK} 0%, #161618 60%, ${CORAL_DARK} 100%)` }}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <span
            className="size-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${CORAL}1f` }}
          >
            <FlameIcon color={CORAL} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.7px] font-bold text-white/60 mb-0.5">
              Streak
            </div>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-mono tabular text-[44px] font-bold leading-none" style={{ color: CORAL }}>
                {semanas}
              </span>
              <span className="text-[13px] font-semibold text-white/80">semanas</span>
            </div>
            <p className="text-[12.5px] text-white/70 leading-snug">
              <span className="font-bold text-white">Sem falhar.</span>{' '}
              Sua disciplina nos enche de orgulho.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardCiclo({ ciclo }: { ciclo: Desempenho['ciclo'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclo atual</CardTitle>
        <CardDescription>
          {ciclo.metaTitulo} · {ciclo.concluidos} de {ciclo.total} {ciclo.total === 1 ? 'treino concluído' : 'treinos concluídos'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[140px_1fr] items-center gap-4">
          <DonutSVG pct={ciclo.pct} />
          <ul className="space-y-2.5">
            <ItemMetrica label="Distância acumulada" valor={`${ciclo.distanciaKm} km`} />
            <ItemMetrica label="Treinos concluídos" valor={String(ciclo.concluidos)} />
            <ItemMetrica label="Pendentes" valor={String(Math.max(0, ciclo.total - ciclo.concluidos))} />
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// SVG donut puro — substitui Recharts PieChart pra um caso de 1 arco.
// Custo: zero bytes de lib externa. Animação opcional via CSS transition.
// Lógica: stroke-dasharray dimensiona o arco em proporção ao pct.
function DonutSVG({ pct }: { pct: number }) {
  const size = 140;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - filled / 100);

  return (
    <div className="relative size-[140px] mx-auto" data-testid="donut-ciclo">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Trilho de fundo */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={stroke}
        />
        {/* Arco preenchido — começa do topo (rotate -90°) */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={CORAL}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 400ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-mono tabular text-[26px] font-bold leading-none" style={{ color: CORAL }}>
          {pct}%
        </span>
        <span className="text-[9.5px] uppercase tracking-wider font-bold text-ink-subtle mt-0.5">
          do ciclo
        </span>
      </div>
    </div>
  );
}

function ItemMetrica({ label, valor }: { label: string; valor: string }) {
  return (
    <li className="flex items-center justify-between border-b border-app last:border-0 pb-2 last:pb-0">
      <span className="text-[11px] text-ink-muted">{label}</span>
      <span className="text-mono text-[14px] font-bold tabular text-ink">{valor}</span>
    </li>
  );
}

function CardEstimativas({
  estimativas,
}: { estimativas: EstimativaProva[] | null }) {
  if (!estimativas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estimativas de prova</CardTitle>
          <CardDescription>Registre seu primeiro RP de corrida (5K, 10K…) para vermos a previsão</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl bg-surface-muted p-6 text-center">
            <div className="text-[12px] text-ink-muted mb-2">Nenhum RP de corrida ainda.</div>
            <Link
              to="/aluno/rps"
              className="inline-flex items-center justify-center h-10 px-4 rounded-2xl bg-accent text-accent-ink font-bold text-[12px]"
            >
              + Registrar RP
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimativas de prova</CardTitle>
        <CardDescription>Previsão baseada nos seus RPs registrados</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {estimativas.map((e) => (
            <div key={e.prova} className="rounded-2xl bg-surface-muted p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1">
                {e.prova}
              </div>
              <div className="text-mono tabular text-[22px] font-bold text-ink leading-none">
                {e.tempo ?? '—'}
              </div>
              <div className="text-[11px] text-ink-muted mt-1.5">
                {e.pace ?? 'sem RP'}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CardResumoMes({ resumo }: { resumo: Desempenho['resumoMes'] }) {
  const cargaFmt = resumo.cargaTotalKg >= 1000
    ? `${(resumo.cargaTotalKg / 1000).toFixed(1)}t`
    : `${resumo.cargaTotalKg}kg`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo do mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: CORAL }}
          >
            <div className="text-[10px] uppercase tracking-[0.6px] font-bold opacity-80 mb-1.5">
              tempo total
            </div>
            <div className="text-mono tabular text-[22px] font-bold leading-none">
              {resumo.tempoFmt}
            </div>
          </div>
          <ResumoCardSimples titulo="distância" valor={`${resumo.distanciaKm} km`} />
          <ResumoCardSimples titulo="treinos" valor={String(resumo.treinos)} />
          <ResumoCardSimples titulo="carga total" valor={cargaFmt} />
        </div>
      </CardContent>
    </Card>
  );
}

export default SecaoDesempenho;
