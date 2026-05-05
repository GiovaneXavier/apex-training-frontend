import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  CORRIDA_SUBTIPO_LABEL,
  MODALIDADE_LABEL,
  type Treino,
  type DetalhesCorrida,
  type DetalhesCiclismo,
  type DetalhesNatacao,
  type DetalhesMusculacao,
  type DetalhesHyrox,
} from '@/types/treino';

const MENT = '#7BC79E'; // verde-menta para a barra lateral

// ─────────────────────────────────────────────────────────────
// Card de um treino dentro do feed do dia.
// Layout: borda esquerda verde-menta, título forte, subtítulo
// (rotina/modalidade), rodapé com 2 ícones+métricas extraídas
// do JSON `detalhes`.
// ─────────────────────────────────────────────────────────────
type Props = {
  treino: Treino;
  /** Nome da rotina/semana, se aplicável (vem da API). */
  subtituloOverride?: string;
  className?: string;
};

export function WorkoutDayCard({ treino, subtituloOverride, className }: Props) {
  const m = extrairMetricas(treino);
  const concluido = treino.status === 'CONCLUIDO';
  const pulado = treino.status === 'PULADO';
  const subtitulo = subtituloOverride ?? subtituloPadrao(treino);

  return (
    <Link to={`/aluno/treino/${treino.id}`} aria-label={`Abrir treino ${treino.titulo}`}>
      <Card
        className={cn(
          'relative overflow-hidden border-0 shadow-[0_2px_18px_-10px_rgba(0,0,0,0.18)]',
          'hover:shadow-[0_4px_22px_-8px_rgba(0,0,0,0.22)] transition-shadow',
          pulado && 'opacity-60',
          className,
        )}
      >
        {/* Barra lateral verde-menta */}
        <span
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ backgroundColor: concluido ? MENT : pulado ? '#cbd5e1' : MENT }}
          aria-hidden
        />

        <CardContent className="p-4 pl-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="min-w-0 flex-1">
              <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
                {subtitulo}
              </div>
              <h3 className="text-[16px] font-bold text-ink leading-tight tracking-tight truncate">
                {treino.titulo}
              </h3>
            </div>
            <StatusPill status={treino.status} />
          </div>

          {m.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-[12px] text-ink-muted font-medium">
              {m.map((metric, i) => (
                <span key={i} className="inline-flex items-center gap-1.5">
                  <span className="text-ink-subtle">{metric.icon}</span>
                  <span className="tabular text-ink font-semibold">{metric.value}</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────
// Card "Descanso" — dia sem evento
// ─────────────────────────────────────────────────────────────
export function RestDayCard() {
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-surface-muted px-5 py-7 text-center">
      <div className="size-9 rounded-full bg-white/80 dark:bg-bg/40 mx-auto mb-2 flex items-center justify-center text-ink-muted">
        <IconMoon />
      </div>
      <div className="text-[13px] font-semibold text-ink-muted">Descanso</div>
      <div className="text-[11px] text-ink-subtle mt-0.5">
        Recuperação faz parte do plano.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Status pill (pequenina, só quando relevante)
// ─────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: Treino['status'] }) {
  if (status === 'PENDENTE') return null;
  const cfg = {
    CONCLUIDO: { bg: 'bg-success-bg', ink: 'text-success', label: 'OK' },
    EM_EXECUCAO: { bg: 'bg-warn-bg', ink: 'text-warn', label: 'Em curso' },
    PULADO: { bg: 'bg-surface-muted', ink: 'text-ink-subtle', label: 'Pulado' },
  }[status]!;
  return (
    <span className={cn('text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex-shrink-0', cfg.bg, cfg.ink)}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Extração de métricas do JSON `detalhes` por modalidade
// ─────────────────────────────────────────────────────────────
type Metric = { icon: React.ReactNode; value: string };

function extrairMetricas(treino: Treino): Metric[] {
  const d = treino.detalhes;
  switch (d.tipo) {
    case 'corrida': return metricasCorrida(d);
    case 'ciclismo': return metricasCiclismo(d);
    case 'natacao': return metricasNatacao(d);
    case 'musculacao': return metricasMusc(d);
    case 'hyrox': return metricasHyrox(d);
    default: return [];
  }
}

function metricasCorrida(d: DetalhesCorrida): Metric[] {
  const out: Metric[] = [];
  const distKm = d.distanciaKm
    ?? somar(d.blocos?.map((b) => (b.distanciaM ?? 0) * (b.repeticoes ?? 1))) / 1000;
  const duracaoMin = somar(d.blocos?.map((b) => (b.duracaoSeg ?? 0) * (b.repeticoes ?? 1))) / 60;

  if (duracaoMin > 0) out.push({ icon: <IconClock />, value: fmtMin(duracaoMin) });
  if (distKm > 0) out.push({ icon: <IconFlag />, value: `${fmtKm(distKm)} km` });
  if (out.length === 0 && d.ritmoAlvoMinKm) {
    out.push({ icon: <IconClock />, value: `${d.ritmoAlvoMinKm}/km` });
  }
  return out.slice(0, 2);
}

function metricasCiclismo(d: DetalhesCiclismo): Metric[] {
  const out: Metric[] = [];
  const distKm = d.distanciaKm
    ?? somar(d.blocos?.map((b) => (b.distanciaKm ?? 0) * (b.repeticoes ?? 1)));
  const duracaoMin = (d.duracaoMin
    ?? somar(d.blocos?.map((b) => (b.duracaoSeg ?? 0) * (b.repeticoes ?? 1))) / 60);
  if (duracaoMin > 0) out.push({ icon: <IconClock />, value: fmtMin(duracaoMin) });
  if (distKm > 0) out.push({ icon: <IconFlag />, value: `${fmtKm(distKm)} km` });
  return out.slice(0, 2);
}

function metricasNatacao(d: DetalhesNatacao): Metric[] {
  const distM = d.blocos
    ? d.blocos.reduce((a, b) => a + b.repeticoes * b.distanciaM, 0)
    : (d.series?.reduce((a, s) => a + s.repeticoes * s.distanciaM, 0) ?? 0);
  const blocos = d.blocos?.length ?? d.series?.length ?? 0;
  const out: Metric[] = [];
  if (distM > 0) out.push({ icon: <IconFlag />, value: `${distM} m` });
  if (blocos > 0) out.push({ icon: <IconList />, value: `${blocos} blocos` });
  return out;
}

function metricasMusc(d: DetalhesMusculacao): Metric[] {
  const totalSeries = d.exercicios.reduce((a, e) => a + e.prescrito.series, 0);
  return [
    { icon: <IconList />, value: `${d.exercicios.length} exer.` },
    { icon: <IconClock />, value: `${totalSeries} séries` },
  ];
}

function metricasHyrox(d: DetalhesHyrox): Metric[] {
  return [{ icon: <IconList />, value: `${d.blocos.length} blocos` }];
}

function subtituloPadrao(treino: Treino): string {
  const d = treino.detalhes;
  if (d.tipo === 'corrida' && d.subtipo) return CORRIDA_SUBTIPO_LABEL[d.subtipo];
  if (d.tipo === 'musculacao') return `Musculação · ${d.exercicios.length} exer.`;
  return MODALIDADE_LABEL[treino.modalidade];
}

function somar(arr?: number[]): number {
  return arr ? arr.reduce((a, b) => a + b, 0) : 0;
}
function fmtMin(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  if (min < 60) {
    const m = Math.floor(min);
    const s = Math.round((min - m) * 60);
    return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m}min`;
  }
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}
function fmtKm(km: number): string {
  if (km < 10) return km.toFixed(2).replace('.', ',');
  return km.toFixed(1).replace('.', ',');
}

// ─────────────────────────────────────────────────────────────
// Ícones inline
// ─────────────────────────────────────────────────────────────
const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);
const IconFlag = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21V4M4 4h12l-2 4 2 4H4" />
  </svg>
);
const IconList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
