import { Link } from 'react-router-dom';
import {
  CORRIDA_SUBTIPO_LABEL,
  HYROX_MOV_LABEL,
  type Treino,
  type DetalhesCorrida,
  type DetalhesCiclismo,
  type DetalhesNatacao,
  type DetalhesMusculacao,
  type DetalhesHyrox,
} from '@/types/treino';
import { cn } from '@/lib/utils';

type Props = {
  treino: Treino;
  href?: string;
  className?: string;
};

// Card de treino estilo "premium" — fundo branco + sombra verde sutil + cantos suaves.
// Renderiza informações específicas por modalidade.
export function TreinoCard({ treino, href, className }: Props) {
  const Wrapper: React.ElementType = href ? Link : 'div';
  const wrapperProps = href ? { to: href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        'block bg-surface rounded-[18px] p-4',
        'border border-app/40',
        'shadow-[0_2px_18px_-8px_rgba(34,197,94,0.18)]',
        'transition-shadow hover:shadow-[0_4px_24px_-6px_rgba(34,197,94,0.28)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ModalidadeIcon treino={treino} />
        <div className="min-w-0 flex-1">
          <Subtitulo treino={treino} />
          <h3 className="text-[15px] font-bold text-ink leading-tight truncate">
            {treino.titulo}
          </h3>
          <Metricas treino={treino} />
        </div>
        <StatusBadge status={treino.status} />
      </div>
    </Wrapper>
  );
}

// ─────────────────────────────────────────────────────────────
// Subtítulo: descreve o tipo do treino em texto curto cinza
// ─────────────────────────────────────────────────────────────
function Subtitulo({ treino }: { treino: Treino }) {
  const txt = subtituloPorModalidade(treino);
  return (
    <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
      {txt}
    </div>
  );
}

function subtituloPorModalidade(treino: Treino): string {
  const d = treino.detalhes;
  switch (d.tipo) {
    case 'corrida':
      return d.subtipo ? CORRIDA_SUBTIPO_LABEL[d.subtipo] : 'Corrida';
    case 'ciclismo':
      return 'Ciclismo';
    case 'natacao':
      return 'Natação';
    case 'musculacao':
      return `Musculação · ${d.exercicios.length} exercícios`;
    case 'hyrox':
      return `Hyrox · ${d.blocos.length} blocos`;
    case 'triathlon':
      return 'Triathlon';
    case 'jiu_jitsu':
      return d.rolas
        ? `Jiu-Jitsu · ${d.rolas.rounds} rolas`
        : 'Jiu-Jitsu';
    case 'outro':
      return 'Treino livre';
  }
}

// ─────────────────────────────────────────────────────────────
// Métricas — renderização específica por modalidade
// ─────────────────────────────────────────────────────────────
function Metricas({ treino }: { treino: Treino }) {
  const d = treino.detalhes;

  if (d.tipo === 'corrida') return <MetricasCorrida d={d} />;
  if (d.tipo === 'ciclismo') return <MetricasCiclismo d={d} />;
  if (d.tipo === 'natacao') return <MetricasNatacao d={d} />;
  if (d.tipo === 'musculacao') return <MetricasMusc d={d} />;
  if (d.tipo === 'hyrox') return <MetricasHyrox d={d} />;
  return null;
}

function MetricasCorrida({ d }: { d: DetalhesCorrida }) {
  const distanciaTotal = d.distanciaKm
    ?? (d.blocos?.reduce((acc, b) => acc + (b.distanciaM ?? 0) * (b.repeticoes ?? 1), 0) ?? 0) / 1000;
  const ritmo = d.ritmoAlvoMinKm ?? d.blocos?.find((b) => b.tipo === 'tiro' || b.tipo === 'continuo')?.ritmoAlvoMinKm;
  return (
    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-muted font-medium">
      {distanciaTotal > 0 && <Metric icon={<IconRoute />} value={`${distanciaTotal.toFixed(1)}km`} />}
      {ritmo && <Metric icon={<IconClock />} value={`${ritmo}/km`} />}
      {d.fcAlvoMax && <Metric icon={<IconHeart />} value={`${d.fcAlvoMin ?? '-'}–${d.fcAlvoMax}bpm`} />}
    </div>
  );
}

function MetricasCiclismo({ d }: { d: DetalhesCiclismo }) {
  const distancia = d.distanciaKm ?? (d.blocos?.reduce((acc, b) => acc + (b.distanciaKm ?? 0) * (b.repeticoes ?? 1), 0) ?? 0);
  const duracao = d.duracaoMin ?? Math.round((d.blocos?.reduce((acc, b) => acc + (b.duracaoSeg ?? 0) * (b.repeticoes ?? 1), 0) ?? 0) / 60);
  const watts = d.potenciaAlvoW ?? d.blocos?.find((b) => b.tipo === 'intervalo' || b.tipo === 'continuo')?.potenciaAlvoW;
  const wattsCalc = watts ?? (d.ftpW && d.blocos?.find((b) => b.potenciaAlvoPctFTP)
    ? Math.round((d.blocos.find((b) => b.potenciaAlvoPctFTP)!.potenciaAlvoPctFTP! / 100) * d.ftpW)
    : undefined);
  return (
    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-muted font-medium">
      {distancia > 0 && <Metric icon={<IconRoute />} value={`${distancia.toFixed(0)}km`} />}
      {duracao > 0 && <Metric icon={<IconClock />} value={`${duracao}min`} />}
      {wattsCalc && <Metric icon={<IconBolt />} value={`${wattsCalc}W`} />}
    </div>
  );
}

function MetricasNatacao({ d }: { d: DetalhesNatacao }) {
  const distTotal = d.blocos
    ? d.blocos.reduce((acc, b) => acc + b.repeticoes * b.distanciaM, 0)
    : (d.series?.reduce((acc, s) => acc + s.repeticoes * s.distanciaM, 0) ?? 0);
  return (
    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-muted font-medium">
      {distTotal > 0 && <Metric icon={<IconWaves />} value={`${distTotal}m`} />}
      {d.cssBaseSegPor100m && (
        <Metric icon={<IconClock />} value={`CSS ${formatPace100m(d.cssBaseSegPor100m)}`} />
      )}
      {d.blocos && <Metric icon={<IconList />} value={`${d.blocos.length} blocos`} />}
    </div>
  );
}

function MetricasMusc({ d }: { d: DetalhesMusculacao }) {
  const totalSeries = d.exercicios.reduce((acc, e) => acc + e.prescrito.series, 0);
  return (
    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-muted font-medium">
      <Metric icon={<IconDumbbell />} value={`${d.exercicios.length} exer.`} />
      <Metric icon={<IconList />} value={`${totalSeries} séries`} />
    </div>
  );
}

function MetricasHyrox({ d }: { d: DetalhesHyrox }) {
  const formatos = Array.from(new Set(d.blocos.map((b) => b.formato)));
  const movs = Array.from(new Set(d.blocos.flatMap((b) => b.exercicios?.map((e) => HYROX_MOV_LABEL[e.movimento]) ?? [])));
  return (
    <div className="flex items-center gap-3 mt-1.5 text-[12px] text-ink-muted font-medium flex-wrap">
      <Metric icon={<IconFire />} value={formatos.join(' · ')} />
      {movs.length > 0 && (
        <span className="text-[11px] text-ink-subtle truncate max-w-[200px]">{movs.slice(0, 3).join(', ')}{movs.length > 3 ? '…' : ''}</span>
      )}
    </div>
  );
}

function Metric({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-subtle">{icon}</span>
      <span className="tabular">{value}</span>
    </span>
  );
}

function formatPace100m(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Status & ícone modalidade
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Treino['status'] }) {
  const cfg: Record<Treino['status'], { bg: string; ink: string; label: string }> = {
    PENDENTE: { bg: 'bg-surface-muted', ink: 'text-ink-muted', label: 'Pendente' },
    EM_EXECUCAO: { bg: 'bg-warn-bg', ink: 'text-warn', label: 'Em curso' },
    CONCLUIDO: { bg: 'bg-success-bg', ink: 'text-success', label: 'OK' },
    PULADO: { bg: 'bg-danger-bg', ink: 'text-danger', label: 'Pulado' },
  };
  const c = cfg[status];
  return (
    <span className={cn('text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full', c.bg, c.ink)}>
      {c.label}
    </span>
  );
}

function ModalidadeIcon({ treino }: { treino: Treino }) {
  const tipo = treino.detalhes.tipo;
  const map: Record<string, React.ReactNode> = {
    musculacao: <IconDumbbell />,
    corrida: <IconRun />,
    ciclismo: <IconBike />,
    natacao: <IconWaves />,
    hyrox: <IconFire />,
    triathlon: <IconRun />,
    outro: <IconList />,
  };
  return (
    <div className="size-10 rounded-[12px] bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
      {map[tipo] ?? <IconList />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Ícones inline (SVG, sem dep externa) — 18×18 padrão
// ─────────────────────────────────────────────────────────────
const SVG = (path: React.ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);
const IconRoute = () => SVG(<><circle cx="6" cy="19" r="3" /><circle cx="18" cy="5" r="3" /><path d="M9 19h7a3 3 0 0 0 0-6h-8a3 3 0 0 1 0-6h7" /></>);
const IconClock = () => SVG(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>);
const IconHeart = () => SVG(<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />);
const IconBolt = () => SVG(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />);
const IconWaves = () => SVG(<><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" /></>);
const IconDumbbell = () => SVG(<><path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" /><path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" /></>);
const IconList = () => SVG(<><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>);
const IconFire = () => SVG(<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2.4-1.5-3.5C8 7 8 5 9 4c-.9 0-3 .9-4 2.5C4 8 3.5 9.5 3.5 12a8.5 8.5 0 1 0 17 0c0-3.6-1.6-7-4-9-.7 1.7-1.6 3.4-3 4.5-1 .8-2 1.6-2 3a2.5 2.5 0 0 0 2.5 2.5" />);
const IconRun = () => SVG(<><circle cx="13" cy="4" r="2" /><path d="m5 22 4-7 3 4 5-8 3 7" /><path d="M9 9h2l3-2" /></>);
const IconBike = () => SVG(<><circle cx="6" cy="15" r="4" /><circle cx="18" cy="15" r="4" /><path d="M6 15 9 6h2l4 9h3" /><path d="M9 6h3" /></>);
