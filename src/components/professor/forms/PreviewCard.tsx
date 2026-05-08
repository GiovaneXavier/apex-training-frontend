import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  HYROX_MOV_LABEL,
  type CiclismoBloco,
  type CorridaBloco,
  type HyroxBloco,
  type NatacaoBloco,
  type TreinoDetalhes,
  type ZonaFTP,
} from '@/types/treino';
import type { ModalidadeUI } from './shared';
import { MODALIDADE_UI_LABEL } from './shared';

const ZONA_BG: Record<ZonaFTP, string> = {
  1: '#9ca3af', 2: '#3b82f6', 3: '#10b981', 4: '#eab308',
  5: '#f97316', 6: '#dc2626', 7: '#7f1d1d',
};

type Props = {
  modalidade: ModalidadeUI;
  titulo: string;
  dataAlvo: string; // datetime-local string
  detalhes: TreinoDetalhes;
};

export function PreviewCard({ modalidade, titulo, dataAlvo, detalhes }: Props) {
  const dataFmt = useMemo(() => {
    if (!dataAlvo) return '';
    try {
      return new Date(dataAlvo).toLocaleDateString('pt-BR', {
        weekday: 'short', day: '2-digit', month: 'short',
      });
    } catch {
      return '';
    }
  }, [dataAlvo]);

  return (
    <Card className="p-0 overflow-hidden bg-ink text-bg">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-[0.7px] font-bold opacity-60 text-mono">
            Preview · {MODALIDADE_UI_LABEL[modalidade]}
          </span>
          <span className="text-[10px] uppercase tracking-[0.7px] font-bold text-accent text-mono">
            ao vivo
          </span>
        </div>

        <div className="text-[10px] uppercase tracking-[0.7px] text-mono opacity-60 font-bold mb-1">
          {dataFmt}
        </div>
        <h3 className="text-[20px] font-bold tracking-tight leading-tight mb-4 break-words">
          {titulo || <span className="opacity-40">(sem título)</span>}
        </h3>

        <PreviewBody detalhes={detalhes} />
      </div>
    </Card>
  );
}

function PreviewBody({ detalhes }: { detalhes: TreinoDetalhes }) {
  switch (detalhes.tipo) {
    case 'musculacao':
      return <PrevMusc detalhes={detalhes} />;
    case 'corrida':
      return <PrevCorrida detalhes={detalhes} />;
    case 'ciclismo':
      return <PrevCiclismo detalhes={detalhes} />;
    case 'natacao':
      return <PrevNatacao detalhes={detalhes} />;
    case 'hyrox':
      return <PrevHyrox detalhes={detalhes} />;
    case 'outro':
      return (
        <p className="text-[13px] opacity-80 leading-relaxed">
          {detalhes.descricao || <span className="opacity-50">Sem descrição</span>}
        </p>
      );
    default:
      return null;
  }
}

function PrevMusc({ detalhes }: { detalhes: Extract<TreinoDetalhes, { tipo: 'musculacao' }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Stat label="Exercícios" value={String(detalhes.exercicios.length)} />
      <ul className="text-[13px] divide-y divide-white/10 mt-2">
        {detalhes.exercicios.slice(0, 8).map((e, i) => (
          <li key={i} className="py-1.5 flex items-center justify-between gap-2">
            <span className="truncate font-medium">{e.nome || <span className="opacity-40">—</span>}</span>
            <span className="text-mono text-[11px] tabular opacity-70 flex-shrink-0">
              {e.prescrito.series}×{e.prescrito.reps}
              {e.prescrito.cargaPctRP ? ` @ ${e.prescrito.cargaPctRP}%` : ''}
            </span>
          </li>
        ))}
        {detalhes.exercicios.length > 8 && (
          <li className="py-1.5 text-[11px] opacity-50">
            +{detalhes.exercicios.length - 8} exercícios
          </li>
        )}
      </ul>
    </div>
  );
}

function PrevCorrida({ detalhes }: { detalhes: Extract<TreinoDetalhes, { tipo: 'corrida' }> }) {
  if (detalhes.blocos && detalhes.blocos.length > 0) {
    const totalM = detalhes.blocos.reduce(
      (acc, b) => acc + (b.distanciaM ?? 0) * (b.repeticoes ?? 1),
      0,
    );
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Stat label="Volume" value={`${(totalM / 1000).toFixed(1)}km`} />
          <Stat label="Blocos" value={String(detalhes.blocos.length)} />
        </div>
        <BlocoList items={detalhes.blocos.map((b) => corridaBlocoToText(b))} />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Distância" value={`${detalhes.distanciaKm ?? 0}km`} />
      <Stat label="Ritmo" value={detalhes.ritmoAlvoMinKm ?? '—'} />
    </div>
  );
}

function PrevCiclismo({ detalhes }: { detalhes: Extract<TreinoDetalhes, { tipo: 'ciclismo' }> }) {
  if (detalhes.blocos && detalhes.blocos.length > 0) {
    const totalSeg = detalhes.blocos.reduce(
      (acc, b) => acc + (b.duracaoSeg ?? 0) * (b.repeticoes ?? 1),
      0,
    );
    return (
      <div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Stat label="FTP" value={detalhes.ftpW ? `${detalhes.ftpW}W` : '—'} />
          <Stat label="Tempo" value={fmtMin(totalSeg)} />
          <Stat label="Blocos" value={String(detalhes.blocos.length)} />
        </div>
        <div className="flex flex-col gap-1">
          {detalhes.blocos.map((b, i) => (
            <CiclismoRow key={i} bloco={b} ftp={detalhes.ftpW} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="Distância" value={`${detalhes.distanciaKm ?? 0}km`} />
      <Stat label="Potência" value={detalhes.potenciaAlvoW ? `${detalhes.potenciaAlvoW}W` : '—'} />
    </div>
  );
}

function PrevNatacao({ detalhes }: { detalhes: Extract<TreinoDetalhes, { tipo: 'natacao' }> }) {
  const blocos = detalhes.blocos ?? [];
  const totalM = blocos.reduce((acc, b) => acc + b.repeticoes * b.distanciaM, 0);
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Stat label="Volume" value={`${totalM}m`} />
        <Stat label="CSS" value={detalhes.cssBaseSegPor100m ? paceFromSegs(detalhes.cssBaseSegPor100m) : '—'} />
      </div>
      <BlocoList items={blocos.map(natacaoBlocoToText)} />
    </div>
  );
}

function PrevHyrox({ detalhes }: { detalhes: Extract<TreinoDetalhes, { tipo: 'hyrox' }> }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <Stat label="Blocos" value={String(detalhes.blocos.length)} />
        <Stat
          label="Run"
          value={String(detalhes.blocos.filter((b) => b.formato === 'RUN').length)}
        />
        <Stat
          label="Estação"
          value={String(detalhes.blocos.filter((b) => b.formato !== 'RUN').length)}
        />
      </div>
      <BlocoList items={detalhes.blocos.map(hyroxBlocoToText)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.6px] font-bold opacity-60 text-mono mb-0.5">
        {label}
      </div>
      <div className="text-[18px] font-bold tabular leading-none text-mono">{value}</div>
    </div>
  );
}

function BlocoList({ items }: { items: string[] }) {
  return (
    <ul className="text-[12px] divide-y divide-white/10 mt-1">
      {items.slice(0, 10).map((it, i) => (
        <li key={i} className="py-1.5 text-mono opacity-90 truncate">
          {String(i + 1).padStart(2, '0')} · {it}
        </li>
      ))}
      {items.length > 10 && (
        <li className="py-1.5 text-[11px] opacity-50">+{items.length - 10} blocos</li>
      )}
    </ul>
  );
}

function CiclismoRow({ bloco, ftp }: { bloco: CiclismoBloco; ftp?: number }) {
  const w =
    bloco.potenciaAlvoW ??
    (ftp && bloco.potenciaAlvoPctFTP
      ? Math.round((ftp * bloco.potenciaAlvoPctFTP) / 100)
      : undefined);
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-[12px] border-b border-white/10 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {bloco.zonaFTP && (
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-bold text-mono uppercase tracking-wider flex-shrink-0"
            style={{ backgroundColor: ZONA_BG[bloco.zonaFTP], color: '#fff' }}
          >
            Z{bloco.zonaFTP}
          </span>
        )}
        <span className="truncate opacity-90">{ciclismoTipoLabel(bloco.tipo)}</span>
      </div>
      <span className="text-mono opacity-70 tabular flex-shrink-0">
        {bloco.repeticoes && bloco.repeticoes > 1 ? `${bloco.repeticoes}× ` : ''}
        {bloco.duracaoSeg ? fmtMin(bloco.duracaoSeg) : ''}
        {w ? ` · ${w}W` : ''}
      </span>
    </div>
  );
}

// ── Formatters ───────────────────────────────────────────────
function corridaBlocoToText(b: CorridaBloco): string {
  const reps = b.repeticoes && b.repeticoes > 1 ? `${b.repeticoes}× ` : '';
  const dist = b.distanciaM ? `${b.distanciaM}m` : b.duracaoSeg ? fmtMin(b.duracaoSeg) : '';
  const ritmo = b.ritmoAlvoMinKm ? ` @ ${b.ritmoAlvoMinKm}/km` : '';
  return `${corridaTipoLabel(b.tipo)} · ${reps}${dist}${ritmo}`;
}

function natacaoBlocoToText(b: NatacaoBloco): string {
  const offset =
    b.paceCssOffsetSeg !== undefined
      ? ` · CSS${b.paceCssOffsetSeg >= 0 ? '+' : ''}${b.paceCssOffsetSeg}s`
      : '';
  const ri = b.descansoSeg !== undefined ? ` · RI ${b.descansoSeg}s` : '';
  return `${b.repeticoes}×${b.distanciaM}m ${estiloLabel(b.estilo)}${offset}${ri}`;
}

function hyroxBlocoToText(b: HyroxBloco): string {
  if (b.formato === 'RUN') return `RUN · ${b.distanciaM}m${b.ritmoAlvoMinKm ? ` @ ${b.ritmoAlvoMinKm}` : ''}`;
  const ex = b.exercicios?.[0];
  const movLabel = ex ? HYROX_MOV_LABEL[ex.movimento] : '—';
  if (b.formato === 'AMRAP' || b.formato === 'FOR_TIME') {
    return `${b.formato} ${b.duracaoSeg ? fmtMin(b.duracaoSeg) : ''} · ${movLabel}`;
  }
  if (b.rounds) return `${b.formato} ${b.rounds}rds · ${movLabel}`;
  return `${b.formato} · ${movLabel}`;
}

function corridaTipoLabel(t: CorridaBloco['tipo']) {
  return ({
    aquecimento: 'Aq',
    tiro: 'Tiro',
    recuperacao: 'Recup',
    volta_calma: 'V.calma',
    continuo: 'Contínuo',
    progressao: 'Progr',
    subida: 'Subida',
  } as const)[t];
}
function ciclismoTipoLabel(t: CiclismoBloco['tipo']) {
  return ({
    aquecimento: 'Aquecimento',
    intervalo: 'Intervalo',
    recuperacao: 'Recuperação',
    continuo: 'Contínuo',
    volta_calma: 'Volta calma',
    sprint: 'Sprint',
  } as const)[t];
}
function estiloLabel(e?: NatacaoBloco['estilo']) {
  return ({
    LIVRE: 'Crawl',
    COSTAS: 'Costas',
    PEITO: 'Peito',
    BORBOLETA: 'Borb',
    MEDLEY: 'Medley',
  } as const)[e ?? 'LIVRE'];
}

function fmtMin(seg: number) {
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m}:${String(s).padStart(2, '0')}` : `${m}min`;
}
function paceFromSegs(seg: number) {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${String(s).padStart(2, '0')}/100m`;
}

// silence unused cn import in some builds
void cn;
