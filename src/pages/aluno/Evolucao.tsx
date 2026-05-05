import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AlunoTabs } from '@/components/AlunoTabs';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import { listEvolucoes, type Evolucao } from '@/lib/api/evolucoes';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────
// Tipo local (compatível com Evolucao do backend + mocks)
// ─────────────────────────────────────────────────────────────
type AvaliadorTipo = 'ALUNO' | 'NUTRICIONISTA' | 'PROFESSOR';

type Avaliacao = {
  id: string;
  dataAvaliacao: string;
  avaliadorTipo: AvaliadorTipo;
  pesoKg?: number;
  alturaCm?: number;
  imc?: number;
  percentualGordura?: number;
  protocolo?: string;
  medidas?: Record<string, any>;
  fotos?: { frente?: string; lado?: string; costas?: string };
  observacoes?: string;
};

function fromBackend(e: Evolucao): Avaliacao {
  return {
    id: e.id,
    dataAvaliacao: e.dataAvaliacao,
    avaliadorTipo: e.avaliadorTipo,
    pesoKg: e.pesoKg ?? undefined,
    alturaCm: e.alturaCm ?? undefined,
    imc: e.imc ?? undefined,
    percentualGordura: e.percentualGordura ?? undefined,
    protocolo: e.protocolo ?? undefined,
    medidas: (e.medidas as any) ?? undefined,
    fotos: (e.fotos as any) ?? undefined,
    observacoes: e.observacoes ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────
// Mock — simula 6 avaliações nos últimos 90 dias
// ─────────────────────────────────────────────────────────────
const HOJE = new Date();
const diaAtras = (n: number) => new Date(HOJE.getTime() - n * 86400000).toISOString();

const MOCK: Avaliacao[] = [
  {
    id: '1',
    dataAvaliacao: diaAtras(90),
    avaliadorTipo: 'NUTRICIONISTA',
    pesoKg: 78.4,
    alturaCm: 178,
    imc: 24.7,
    percentualGordura: 18.2,
    protocolo: 'JP7',
    medidas: {
      tipo: 'ISAK_RESTRITO',
      perimetros: { cintura: 86, quadril: 98, braco: 32, coxa: 56, panturrilha: 38 },
      dobras: { triceps: 12, subescapular: 14, biceps: 6, axilar: 11, supra: 13, abdominal: 18, coxa: 14 },
    },
    fotos: { frente: 'https://placehold.co/400x600/e2e8f0/64748b?text=Frente+90d', lado: 'https://placehold.co/400x600/e2e8f0/64748b?text=Lado+90d', costas: 'https://placehold.co/400x600/e2e8f0/64748b?text=Costas+90d' },
  },
  {
    id: '2',
    dataAvaliacao: diaAtras(75),
    avaliadorTipo: 'ALUNO',
    pesoKg: 78.1,
    medidas: { tipo: 'ALUNO_FITA', cinturaCm: 85.5 },
  },
  {
    id: '3',
    dataAvaliacao: diaAtras(60),
    avaliadorTipo: 'NUTRICIONISTA',
    pesoKg: 77.5,
    alturaCm: 178,
    imc: 24.5,
    percentualGordura: 17.4,
    protocolo: 'JP7',
    medidas: {
      tipo: 'ISAK_RESTRITO',
      perimetros: { cintura: 84.5, quadril: 97.5, braco: 32.5, coxa: 56.2, panturrilha: 38.2 },
    },
    fotos: { frente: 'https://placehold.co/400x600/dbeafe/1e40af?text=Frente+60d', lado: 'https://placehold.co/400x600/dbeafe/1e40af?text=Lado+60d', costas: 'https://placehold.co/400x600/dbeafe/1e40af?text=Costas+60d' },
  },
  {
    id: '4',
    dataAvaliacao: diaAtras(45),
    avaliadorTipo: 'ALUNO',
    pesoKg: 76.9,
    medidas: { tipo: 'ALUNO_FITA', cinturaCm: 83.5 },
  },
  {
    id: '5',
    dataAvaliacao: diaAtras(30),
    avaliadorTipo: 'NUTRICIONISTA',
    pesoKg: 76.2,
    alturaCm: 178,
    imc: 24.1,
    percentualGordura: 16.1,
    protocolo: 'JP7',
    medidas: {
      tipo: 'ISAK_RESTRITO',
      perimetros: { cintura: 82.5, quadril: 96.8, braco: 33, coxa: 56.5, panturrilha: 38.4 },
    },
    fotos: { frente: 'https://placehold.co/400x600/dcfce7/15803d?text=Frente+30d', lado: 'https://placehold.co/400x600/dcfce7/15803d?text=Lado+30d', costas: 'https://placehold.co/400x600/dcfce7/15803d?text=Costas+30d' },
  },
  {
    id: '6',
    dataAvaliacao: diaAtras(7),
    avaliadorTipo: 'NUTRICIONISTA',
    pesoKg: 75.4,
    alturaCm: 178,
    imc: 23.8,
    percentualGordura: 15.3,
    protocolo: 'JP7',
    medidas: {
      tipo: 'ISAK_RESTRITO',
      perimetros: { cintura: 81, quadril: 96, braco: 33.5, coxa: 57, panturrilha: 38.6 },
    },
    fotos: { frente: 'https://placehold.co/400x600/fef3c7/a16207?text=Frente+hoje', lado: 'https://placehold.co/400x600/fef3c7/a16207?text=Lado+hoje', costas: 'https://placehold.co/400x600/fef3c7/a16207?text=Costas+hoje' },
  },
];

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────
type Periodo = 7 | 30 | 60 | 90;
const PERIODOS: Periodo[] = [7, 30, 60, 90];

type MetricaKey = 'pesoKg' | 'percentualGordura' | 'imc' | 'cintura';

const METRICAS: { key: MetricaKey; label: string; unidade: string; melhorMenor: boolean; cor: string }[] = [
  { key: 'pesoKg', label: 'Peso', unidade: 'kg', melhorMenor: true, cor: '#22c55e' },
  { key: 'percentualGordura', label: '% Gordura', unidade: '%', melhorMenor: true, cor: '#3b82f6' },
  { key: 'imc', label: 'IMC', unidade: '', melhorMenor: true, cor: '#a855f7' },
  { key: 'cintura', label: 'Cintura', unidade: 'cm', melhorMenor: true, cor: '#f97316' },
];

export default function AlunoEvolucao() {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [metricaSel, setMetricaSel] = useState<MetricaKey>('pesoKg');
  const [fotoIdx, setFotoIdx] = useState(0);
  const [todas, setTodas] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usandoMock, setUsandoMock] = useState(false);

  // Carrega dados reais do backend; se vazio, usa mocks pra UX.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    listEvolucoes({ alunoId: user.aluno?.id, limit: 200 })
      .then((items) => {
        if (cancelled) return;
        if (items.length === 0) {
          setTodas(MOCK);
          setUsandoMock(true);
        } else {
          setTodas(items.map(fromBackend));
          setUsandoMock(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(apiErrorMessage(err));
        setTodas(MOCK);
        setUsandoMock(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  const avaliacoes = useMemo(() => {
    const limite = HOJE.getTime() - periodo * 86400000;
    return todas
      .filter((a) => new Date(a.dataAvaliacao).getTime() >= limite)
      .sort((a, b) => new Date(a.dataAvaliacao).getTime() - new Date(b.dataAvaliacao).getTime());
  }, [periodo, todas]);

  const fotosOrdenadas = useMemo(
    () => todas.filter((a) => a.fotos?.frente).sort(
      (a, b) => new Date(b.dataAvaliacao).getTime() - new Date(a.dataAvaliacao).getTime(),
    ),
    [todas],
  );

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
        <Link
          to="/aluno/evolucao/nova"
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-accent text-accent-ink"
        >
          + Avaliação
        </Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Evolução corporal</h1>
        <p className="text-ink-muted text-sm mb-3">
          {avaliacoes.length} {avaliacoes.length === 1 ? 'avaliação' : 'avaliações'} nos últimos {periodo} dias
        </p>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}
        {usandoMock && !loading && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-warn-bg text-warn text-[11px] font-medium">
            Mostrando dados de exemplo. Adicione sua primeira avaliação para ver dados reais.
          </div>
        )}

        {/* Filtro período */}
        <div className="grid grid-cols-4 gap-1.5 mb-5">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={cn(
                'py-2 rounded-[10px] text-[11px] font-bold uppercase tracking-wider',
                periodo === p ? 'bg-ink text-bg' : 'bg-surface border border-app-strong text-ink-muted',
              )}
            >
              {p}d
            </button>
          ))}
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {METRICAS.map((m) => (
            <ResumoCard
              key={m.key}
              metrica={m}
              avaliacoes={avaliacoes}
              selecionada={metricaSel === m.key}
              onSelect={() => setMetricaSel(m.key)}
            />
          ))}
        </div>

        {/* Gráfico de linha */}
        <div className="rounded-[18px] bg-surface border border-app p-4 mb-6 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
                Tendência
              </div>
              <div className="text-[15px] font-bold">
                {METRICAS.find((m) => m.key === metricaSel)?.label}
              </div>
            </div>
            <span
              className="size-2.5 rounded-full"
              style={{ background: METRICAS.find((m) => m.key === metricaSel)?.cor }}
            />
          </div>
          <LineChart
            points={extrairSerie(avaliacoes, metricaSel)}
            cor={METRICAS.find((m) => m.key === metricaSel)!.cor}
            unidade={METRICAS.find((m) => m.key === metricaSel)!.unidade}
          />
        </div>

        {/* Galeria de fotos lado a lado */}
        {fotosOrdenadas.length > 1 && (
          <>
            <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 text-mono">
              Fotos · comparação
            </h2>
            <FotosCarrossel fotos={fotosOrdenadas} idx={fotoIdx} onIdx={setFotoIdx} />
          </>
        )}

        {/* Histórico de avaliações */}
        <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 mt-6 text-mono">
          Histórico
        </h2>
        <div className="flex flex-col gap-2">
          {[...avaliacoes].reverse().map((a) => (
            <AvaliacaoRow key={a.id} a={a} />
          ))}
        </div>
      </div>

      <AlunoTabs />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de extração
// ─────────────────────────────────────────────────────────────
function extrairValor(a: Avaliacao, key: MetricaKey): number | null {
  if (key === 'cintura') {
    const m = a.medidas as any;
    return m?.cinturaCm ?? m?.perimetros?.cintura ?? null;
  }
  return (a as any)[key] ?? null;
}

function extrairSerie(avaliacoes: Avaliacao[], key: MetricaKey): { x: number; y: number; date: string }[] {
  return avaliacoes
    .map((a) => ({ a, v: extrairValor(a, key) }))
    .filter((p): p is { a: Avaliacao; v: number } => p.v !== null)
    .map((p) => ({ x: new Date(p.a.dataAvaliacao).getTime(), y: p.v, date: p.a.dataAvaliacao }));
}

function fmtDataCurta(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Card de resumo: valor atual + delta + seta
// ─────────────────────────────────────────────────────────────
function ResumoCard({
  metrica, avaliacoes, selecionada, onSelect,
}: {
  metrica: typeof METRICAS[number];
  avaliacoes: Avaliacao[];
  selecionada: boolean;
  onSelect: () => void;
}) {
  const serie = extrairSerie(avaliacoes, metrica.key);
  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2] ?? serie[0];
  const delta = ultimo && anterior && ultimo !== anterior ? ultimo.y - anterior.y : null;

  const isMelhora = delta !== null
    ? (metrica.melhorMenor ? delta < 0 : delta > 0)
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'text-left p-3.5 rounded-[16px] transition-all',
        selecionada
          ? 'bg-ink text-bg border border-ink'
          : 'bg-surface border border-app hover:border-ink-muted',
      )}
    >
      <div className={cn(
        'text-mono text-[10px] uppercase tracking-[0.6px] font-bold mb-1.5',
        selecionada ? 'opacity-70' : 'text-ink-subtle',
      )}>
        {metrica.label}
      </div>
      <div className="text-mono text-[24px] font-bold tabular leading-none mb-1">
        {ultimo ? ultimo.y.toFixed(metrica.key === 'imc' ? 1 : 1) : '—'}
        <span className={cn('text-[12px] font-medium ml-1', selecionada ? 'opacity-60' : 'text-ink-muted')}>
          {metrica.unidade}
        </span>
      </div>
      {delta !== null && isMelhora !== null && (
        <div className={cn(
          'inline-flex items-center gap-1 text-[11px] font-bold',
          isMelhora
            ? selecionada ? 'text-success-ink' : 'text-success'
            : selecionada ? 'text-danger' : 'text-danger',
        )}>
          <span>{isMelhora ? '↓' : '↑'}</span>
          <span className="tabular">
            {Math.abs(delta).toFixed(1)}{metrica.unidade}
          </span>
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// LineChart — SVG inline, sem deps externas
// ─────────────────────────────────────────────────────────────
function LineChart({
  points, cor, unidade,
}: {
  points: { x: number; y: number; date: string }[];
  cor: string;
  unidade: string;
}) {
  const W = 320, H = 160, P = 28; // largura, altura, padding interno

  if (points.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-ink-subtle text-[12px]">
        Sem dados no período.
      </div>
    );
  }

  if (points.length === 1) {
    const p = points[0];
    return (
      <div className="h-[160px] flex flex-col items-center justify-center gap-1">
        <div className="text-mono text-[28px] font-bold tabular text-ink">{p.y.toFixed(1)}{unidade}</div>
        <div className="text-[11px] text-ink-subtle">{fmtDataCurta(p.date)}</div>
        <div className="text-[10px] text-ink-subtle uppercase tracking-wider mt-1">
          Apenas 1 medição — adicione mais para ver tendência
        </div>
      </div>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.15 || 1;
  const yMinPad = yMin - yPad, yMaxPad = yMax + yPad;

  const xScale = (x: number) => P + ((x - xMin) / (xMax - xMin || 1)) * (W - 2 * P);
  const yScale = (y: number) => H - P - ((y - yMinPad) / (yMaxPad - yMinPad || 1)) * (H - 2 * P);

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`)
    .join(' ');
  const area = `${path} L ${xScale(points[points.length - 1].x).toFixed(1)} ${H - P} L ${xScale(points[0].x).toFixed(1)} ${H - P} Z`;

  // 4 linhas-guia horizontais
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMinPad + t * (yMaxPad - yMinPad));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[160px]" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${cor.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Linhas-guia */}
        {yTicks.map((y, i) => (
          <line
            key={i}
            x1={P} x2={W - P}
            y1={yScale(y)} y2={yScale(y)}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />
        ))}

        {/* Área sombreada */}
        <path d={area} fill={`url(#grad-${cor.replace('#', '')})`} />

        {/* Linha */}
        <path d={path} stroke={cor} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* Pontos */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xScale(p.x)} cy={yScale(p.y)} r="4" fill={cor} />
            <circle cx={xScale(p.x)} cy={yScale(p.y)} r="2" fill="white" />
          </g>
        ))}

        {/* Min/Max labels */}
        <text x={P - 4} y={yScale(yMax) + 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5" fontFamily="monospace">
          {yMax.toFixed(1)}
        </text>
        <text x={P - 4} y={yScale(yMin) + 4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.5" fontFamily="monospace">
          {yMin.toFixed(1)}
        </text>
      </svg>

      <div className="flex justify-between mt-2 text-[10px] text-ink-subtle font-mono tabular px-1">
        <span>{fmtDataCurta(points[0].date)}</span>
        <span>{fmtDataCurta(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Carrossel de fotos: comparação lado a lado (atual vs selecionada)
// ─────────────────────────────────────────────────────────────
function FotosCarrossel({
  fotos, idx, onIdx,
}: {
  fotos: Avaliacao[];
  idx: number;
  onIdx: (i: number) => void;
}) {
  const atual = fotos[0]; // mais recente
  const comparada = fotos[Math.min(idx, fotos.length - 1)];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-2 mb-3">
        <FotoFrame label="Hoje" data={atual.dataAvaliacao} url={atual.fotos?.frente} />
        <FotoFrame label="Comparar" data={comparada.dataAvaliacao} url={comparada.fotos?.frente} />
      </div>
      {/* Selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {fotos.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onIdx(i)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold border',
              i === idx
                ? 'bg-ink text-bg border-ink'
                : 'bg-surface border-app-strong text-ink-muted',
            )}
          >
            {fmtDataCurta(f.dataAvaliacao)}
          </button>
        ))}
      </div>
    </div>
  );
}

function FotoFrame({ label, data, url }: { label: string; data: string; url?: string }) {
  return (
    <div className="rounded-[14px] bg-surface border border-app overflow-hidden">
      <div className="aspect-[2/3] bg-surface-muted flex items-center justify-center">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-ink-subtle text-[11px]">sem foto</span>
        )}
      </div>
      <div className="px-3 py-2">
        <div className="text-mono text-[9px] uppercase tracking-[0.6px] text-ink-subtle font-bold">{label}</div>
        <div className="text-[12px] font-semibold">{fmtDataCurta(data)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Linha do histórico
// ─────────────────────────────────────────────────────────────
function AvaliacaoRow({ a }: { a: Avaliacao }) {
  const cintura = (a.medidas as any)?.cinturaCm ?? (a.medidas as any)?.perimetros?.cintura;
  return (
    <div className="px-4 py-3 rounded-[12px] bg-surface border border-app">
      <div className="flex items-center justify-between mb-1">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">
          {fmtDataCurta(a.dataAvaliacao)}
        </div>
        <AvaliadorBadge tipo={a.avaliadorTipo} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px]">
        {a.pesoKg !== undefined && <Item label="Peso" value={`${a.pesoKg}kg`} />}
        {a.percentualGordura !== undefined && <Item label="%BF" value={`${a.percentualGordura}%`} />}
        {a.imc !== undefined && <Item label="IMC" value={a.imc.toFixed(1)} />}
        {cintura !== undefined && <Item label="Cintura" value={`${cintura}cm`} />}
        {a.protocolo && <Item label="Protocolo" value={a.protocolo} />}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">{label}</span>
      <span className="text-ink font-semibold tabular">{value}</span>
    </span>
  );
}

function AvaliadorBadge({ tipo }: { tipo: AvaliadorTipo }) {
  const cfg = {
    ALUNO: { bg: 'bg-surface-muted', ink: 'text-ink-muted', label: 'Aluno' },
    NUTRICIONISTA: { bg: 'bg-accent/10', ink: 'text-accent', label: 'Nutri' },
    PROFESSOR: { bg: 'bg-accent/10', ink: 'text-accent', label: 'Coach' },
  }[tipo];
  return (
    <span className={cn('text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full', cfg.bg, cfg.ink)}>
      {cfg.label}
    </span>
  );
}
