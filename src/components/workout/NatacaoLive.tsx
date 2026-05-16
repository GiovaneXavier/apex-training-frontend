import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import { salvarExecucaoOfflineFirst } from '@/lib/api/execucao';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  DetalhesNatacao,
  EstiloNado,
  NatacaoBloco,
  Treino,
} from '@/types/treino';

type Props = { treino: Treino };

const ESTILO_LABEL: Record<EstiloNado, string> = {
  LIVRE: 'Crawl',
  COSTAS: 'Costas',
  PEITO: 'Peito',
  BORBOLETA: 'Borboleta',
  MEDLEY: 'Medley',
};

const BLOCO_LABEL: Record<NatacaoBloco['tipo'], string> = {
  aquecimento: 'Aquecimento',
  principal: 'Principal',
  tecnica: 'Técnica',
  volta_calma: 'Volta calma',
};

const EQUIP_LABEL: Record<NonNullable<NatacaoBloco['equipamento']>[number], string> = {
  palmar: 'Palmar',
  pull_buoy: 'Pull-buoy',
  pe_de_pato: 'Pé-de-pato',
  snorkel: 'Snorkel',
  prancha: 'Prancha',
};

export function NatacaoLive({ treino }: Props) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const detalhes = treino.detalhes as DetalhesNatacao;
  const realizadoAtual = detalhes.realizado ?? null;
  const blocos = detalhes.blocos ?? [];
  const cssBase = detalhes.cssBaseSegPor100m;

  const distanciaTotalPrescrita = blocos.reduce(
    (acc, b) => acc + (b.repeticoes ?? 0) * (b.distanciaM ?? 0),
    0,
  );

  const [distanciaTotalM, setDistanciaTotalM] = useState<string>(
    realizadoAtual?.distanciaTotalM !== undefined
      ? String(realizadoAtual.distanciaTotalM)
      : String(distanciaTotalPrescrita || ''),
  );
  const [duracao, setDuracao] = useState<string>(
    realizadoAtual?.duracaoSeg !== undefined ? formatDuracao(realizadoAtual.duracaoSeg) : '',
  );
  const [observacao, setObservacao] = useState<string>(realizadoAtual?.observacao ?? '');
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleBloco(idx: number) {
    setBlocosConcluidos((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!distanciaTotalM && !duracao) {
      setError('Informe distância total ou tempo realizado');
      return;
    }
    const duracaoSeg = duracao ? parseDuracao(duracao) : undefined;
    if (duracao && duracaoSeg === null) {
      setError('Tempo inválido (use MM:SS ou HH:MM:SS)');
      return;
    }

    setSubmitting(true);
    try {
      const result = await salvarExecucaoOfflineFirst(treino.id, {
        realizado: {
          distanciaTotalM: distanciaTotalM ? Number(distanciaTotalM) : undefined,
          duracaoSeg: duracaoSeg ?? undefined,
          observacao: observacao || undefined,
        },
        status: 'CONCLUIDO',
      });
      if (result.kind === 'queued') {
        toast.success('Treino salvo offline · sincronizamos quando voltar a rede');
      }
      navigate('/aluno/dashboard?ok=1', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const blocoAtualIdx = blocos.findIndex((_, i) => !blocosConcluidos.has(i));

  return (
    <div className="min-h-screen bg-bg text-ink pb-12">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/aluno/dashboard')}
          className="text-mono text-[12px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Voltar
        </button>
        <span
          className={cn(
            'text-mono text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
            theme === 'dark' ? 'bg-accent text-accent-ink' : 'bg-ink text-bg',
          )}
        >
          Natação
        </span>
      </header>

      <div className="px-5">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
          {formatDate(treino.dataAlvo)}
        </div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-5">
          {treino.titulo}
        </h1>

        {/* Hero card — alto contraste, números enormes para borda da piscina */}
        <div className="rounded-[18px] bg-ink text-bg p-5 mb-5">
          <div className="text-[10px] uppercase tracking-[0.7px] font-bold opacity-70 text-mono mb-3">
            Volume da Sessão
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            <BigStat label="Distância" value={String(distanciaTotalPrescrita)} suffix="m" />
            <BigStat label="Blocos" value={String(blocos.length)} />
            {cssBase !== undefined && (
              <BigStat
                label="CSS Base"
                value={paceFromSegs(cssBase)}
                suffix="/100m"
              />
            )}
          </div>
        </div>

        {/* Blocos */}
        {blocos.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-mono text-[12px] uppercase tracking-[0.7px] font-bold text-ink">
                Séries
              </div>
              <div className="text-mono text-[12px] tabular font-bold text-ink-muted">
                {blocosConcluidos.size}/{blocos.length}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {blocos.map((b, idx) => (
                <BlocoCard
                  key={idx}
                  bloco={b}
                  index={idx}
                  cssBase={cssBase}
                  done={blocosConcluidos.has(idx)}
                  current={idx === blocoAtualIdx}
                  onToggle={() => toggleBloco(idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Realizado */}
        <form onSubmit={onSubmit}>
          <div className="text-mono text-[12px] uppercase tracking-[0.7px] font-bold text-ink mb-3">
            Realizado
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <Field
              label="Distância (m)"
              value={distanciaTotalM}
              onChange={setDistanciaTotalM}
              placeholder={String(distanciaTotalPrescrita || '—')}
              type="number"
              step="50"
            />
            <Field
              label="Tempo (HH:MM:SS)"
              value={duracao}
              onChange={setDuracao}
              placeholder="45:00"
            />
          </div>
          <label className="block mb-3">
            <span className="block text-[10px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
              Observações
            </span>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Sensações, dificuldades, equipamento usado..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] outline-none focus:border-accent resize-none"
            />
          </label>

          {error && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[13px] font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-[14px] bg-accent text-accent-ink font-bold text-[16px] uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Salvando...' : (
              <>
                <span className="text-[20px] leading-none">✓</span>
                Concluir treino
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function BlocoCard({
  bloco,
  index,
  cssBase,
  done,
  current,
  onToggle,
}: {
  bloco: NatacaoBloco;
  index: number;
  cssBase?: number;
  done: boolean;
  current: boolean;
  onToggle: () => void;
}) {
  const totalM = (bloco.repeticoes ?? 0) * (bloco.distanciaM ?? 0);

  // Pace alvo: absoluto OR relativo ao CSS
  let paceAlvo: string | null = null;
  if (bloco.paceAlvoSegPor100m !== undefined) {
    paceAlvo = paceFromSegs(bloco.paceAlvoSegPor100m);
  } else if (bloco.paceCssOffsetSeg !== undefined && cssBase !== undefined) {
    const total = cssBase + bloco.paceCssOffsetSeg;
    paceAlvo = paceFromSegs(total);
  }
  const cssOffsetLabel =
    bloco.paceCssOffsetSeg !== undefined
      ? `CSS${bloco.paceCssOffsetSeg >= 0 ? '+' : ''}${bloco.paceCssOffsetSeg}s`
      : null;

  return (
    <div
      className={cn(
        'rounded-[16px] border-2 bg-surface p-4 transition-all',
        done && 'opacity-50',
        current && !done ? 'border-accent shadow-md' : 'border-app-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono">
            #{index + 1} · {BLOCO_LABEL[bloco.tipo]}
          </div>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[28px] font-bold tabular leading-none text-ink text-mono">
              {bloco.repeticoes}×{bloco.distanciaM}m
            </span>
            {bloco.estilo && (
              <span className="px-2 py-0.5 rounded-full bg-ink text-bg text-[10px] uppercase tracking-[0.6px] font-bold text-mono">
                {ESTILO_LABEL[bloco.estilo]}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex-shrink-0 size-12 rounded-full flex items-center justify-center text-[22px] font-bold transition-all border-2',
            done
              ? 'bg-accent text-accent-ink border-accent'
              : 'bg-surface text-ink-subtle border-app-strong hover:border-accent hover:text-ink',
          )}
          aria-label={done ? 'Desmarcar série' : 'Marcar série como concluída'}
          aria-pressed={done}
        >
          ✓
        </button>
      </div>

      {/* RI / Send-off — destaque máximo (info crucial na natação) */}
      {(bloco.descansoSeg !== undefined || bloco.sendOffSeg !== undefined) && (
        <div className="rounded-[10px] bg-bg border-2 border-app-strong p-2.5 mb-3 flex items-center justify-around">
          {bloco.descansoSeg !== undefined && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono mb-0.5">
                Descanso (RI)
              </div>
              <div className="text-[22px] font-bold tabular leading-none text-mono text-ink">
                {formatDuracaoCurto(bloco.descansoSeg)}
              </div>
            </div>
          )}
          {bloco.sendOffSeg !== undefined && (
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono mb-0.5">
                Send-off
              </div>
              <div className="text-[22px] font-bold tabular leading-none text-mono text-ink">
                {formatDuracaoCurto(bloco.sendOffSeg)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {paceAlvo && (
          <div>
            <div className="text-[9px] uppercase tracking-[0.5px] font-bold text-ink-subtle text-mono mb-1">
              Pace alvo
            </div>
            <div className="text-[18px] font-bold tabular leading-none text-mono text-ink">
              {paceAlvo}
              <span className="text-[10px] text-ink-muted font-bold ml-0.5">/100m</span>
            </div>
            {cssOffsetLabel && (
              <div className="text-[10px] text-ink-subtle text-mono mt-0.5">{cssOffsetLabel}</div>
            )}
          </div>
        )}
        <div>
          <div className="text-[9px] uppercase tracking-[0.5px] font-bold text-ink-subtle text-mono mb-1">
            Volume
          </div>
          <div className="text-[18px] font-bold tabular leading-none text-mono text-ink">
            {totalM}
            <span className="text-[10px] text-ink-muted font-bold ml-0.5">m</span>
          </div>
        </div>
      </div>

      {bloco.equipamento && bloco.equipamento.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bloco.equipamento.map((eq) => (
            <span
              key={eq}
              className="px-2 py-0.5 rounded-full bg-surface-muted text-ink-muted text-[10px] uppercase tracking-[0.5px] font-bold text-mono border border-app"
            >
              {EQUIP_LABEL[eq]}
            </span>
          ))}
        </div>
      )}

      {bloco.observacao && (
        <div className="mt-2 text-[12px] text-ink-muted italic">{bloco.observacao}</div>
      )}
    </div>
  );
}

function BigStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.6px] font-bold opacity-70 text-mono mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[40px] font-bold tabular leading-none text-mono">{value}</span>
        {suffix && <span className="text-[14px] opacity-70 font-bold">{suffix}</span>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
        {label}
      </span>
      <input
        type={type}
        step={step}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-[12px] bg-surface border border-app-strong text-ink text-mono text-[16px] font-bold tabular outline-none focus:border-accent"
      />
    </label>
  );
}

// ── Helpers ─────────────────────────────────────────────────────
function paceFromSegs(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = Math.round(seg % 60);
  return `${m}:${pad(s)}`;
}

function parseDuracao(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

function formatDuracao(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatDuracaoCurto(seg: number): string {
  if (seg < 60) return `${seg}s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  if (s === 0) return `${m}min`;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
