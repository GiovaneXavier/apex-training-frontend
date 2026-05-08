import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import { salvarExecucao } from '@/lib/api/execucao';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  DetalhesHyrox,
  HyroxBloco,
  HyroxExercicio,
  HyroxFormato,
  Treino,
} from '@/types/treino';
import { HYROX_MOV_LABEL } from '@/types/treino';

type Props = { treino: Treino };

const FORMATO_LABEL: Record<HyroxFormato, string> = {
  AMRAP: 'AMRAP',
  EMOM: 'EMOM',
  FOR_TIME: 'For Time',
  TABATA: 'Tabata',
  INTERVAL: 'Intervalo',
  RUN: 'Run',
  STATION: 'Estação',
};

// Cores por formato — vibe "checklist de sobrevivência"
const FORMATO_COLORS: Record<HyroxFormato, { bg: string; text: string }> = {
  RUN: { bg: '#3b82f6', text: '#ffffff' },          // azul → corrida
  STATION: { bg: '#fc4c02', text: '#ffffff' },      // coral apex → estação
  AMRAP: { bg: '#dc2626', text: '#ffffff' },        // vermelho → max effort
  EMOM: { bg: '#7c3aed', text: '#ffffff' },         // roxo → tempo
  FOR_TIME: { bg: '#0891b2', text: '#ffffff' },     // ciano → corrida contra relógio
  TABATA: { bg: '#be185d', text: '#ffffff' },       // rosa-vermelho → 20/10
  INTERVAL: { bg: '#059669', text: '#ffffff' },     // verde → on/off
};

type Realizado = { tempoSeg?: number; reps?: number };

export function HyroxLive({ treino }: Props) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const detalhes = treino.detalhes as DetalhesHyrox;
  const blocos = detalhes.blocos ?? [];

  const [done, setDone] = useState<Set<number>>(new Set());
  const [realizadoPorBloco, setRealizadoPorBloco] = useState<Record<number, Realizado>>({});
  const [tempoTotal, setTempoTotal] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDone(idx: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function setBlocoTempo(idx: number, valor: string) {
    const seg = valor ? parseDuracao(valor) ?? undefined : undefined;
    setRealizadoPorBloco((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], tempoSeg: seg },
    }));
  }

  function setBlocoReps(idx: number, valor: string) {
    const reps = valor ? Number(valor) : undefined;
    setRealizadoPorBloco((prev) => ({
      ...prev,
      [idx]: { ...prev[idx], reps },
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const tempoTotalSeg = tempoTotal ? parseDuracao(tempoTotal) : undefined;
    if (tempoTotal && tempoTotalSeg === null) {
      setError('Tempo total inválido (use MM:SS ou HH:MM:SS)');
      return;
    }

    setSubmitting(true);
    try {
      await salvarExecucao(treino.id, {
        realizado: {
          tempoTotalSeg: tempoTotalSeg ?? undefined,
          observacao: observacao || undefined,
          blocos: Object.entries(realizadoPorBloco).map(([idx, r]) => ({
            indice: Number(idx),
            ...r,
          })),
          blocosConcluidos: Array.from(done).sort((a, b) => a - b),
        },
        status: 'CONCLUIDO',
      });
      navigate('/aluno/dashboard?ok=1', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const blocoAtualIdx = blocos.findIndex((_, i) => !done.has(i));

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
          Hyrox
        </span>
      </header>

      <div className="px-5">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
          {formatDate(treino.dataAlvo)}
        </div>
        <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-5">
          {treino.titulo}
        </h1>

        {/* Hero — checklist de sobrevivência */}
        <div className="rounded-[18px] bg-ink text-bg p-5 mb-5">
          <div className="text-[10px] uppercase tracking-[0.7px] font-bold opacity-70 text-mono mb-3">
            Sessão
          </div>
          <div className="grid grid-cols-3 gap-3">
            <BigStat label="Estações" value={String(blocos.length)} />
            <BigStat label="Concluídas" value={`${done.size}/${blocos.length}`} />
            <BigStat
              label="Run"
              value={String(blocos.filter((b) => b.formato === 'RUN').length)}
            />
          </div>
        </div>

        {/* Lista de blocos como checklist */}
        <div className="mb-6">
          <div className="text-mono text-[12px] uppercase tracking-[0.7px] font-bold text-ink mb-3">
            Plano de Ataque
          </div>
          <div className="flex flex-col gap-2.5">
            {blocos.map((b, idx) => (
              <BlocoCard
                key={idx}
                bloco={b}
                index={idx}
                done={done.has(idx)}
                current={idx === blocoAtualIdx}
                realizado={realizadoPorBloco[idx]}
                onToggle={() => toggleDone(idx)}
                onTempo={(v) => setBlocoTempo(idx, v)}
                onReps={(v) => setBlocoReps(idx, v)}
              />
            ))}
          </div>
        </div>

        {/* Form realizado global */}
        <form onSubmit={onSubmit}>
          <div className="text-mono text-[12px] uppercase tracking-[0.7px] font-bold text-ink mb-3">
            Resultado Final
          </div>
          <div className="mb-2.5">
            <Field
              label="Tempo total (HH:MM:SS)"
              value={tempoTotal}
              onChange={setTempoTotal}
              placeholder="1:25:30"
            />
          </div>
          <label className="block mb-3">
            <span className="block text-[10px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
              Observações
            </span>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Onde quebrou, estações mais difíceis, sensações..."
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

// ─────────────────────────────────────────────────────────────
// BlocoCard — adapta UI por formato
// ─────────────────────────────────────────────────────────────
function BlocoCard({
  bloco,
  index,
  done,
  current,
  realizado,
  onToggle,
  onTempo,
  onReps,
}: {
  bloco: HyroxBloco;
  index: number;
  done: boolean;
  current: boolean;
  realizado?: Realizado;
  onToggle: () => void;
  onTempo: (v: string) => void;
  onReps: (v: string) => void;
}) {
  const colors = FORMATO_COLORS[bloco.formato];
  const isRun = bloco.formato === 'RUN';
  const hasTimer =
    bloco.formato === 'AMRAP' ||
    bloco.formato === 'EMOM' ||
    bloco.formato === 'TABATA' ||
    bloco.formato === 'INTERVAL' ||
    bloco.formato === 'FOR_TIME';

  // Cap do timer: AMRAP/FOR_TIME → duracaoSeg; EMOM/TABATA → rounds × on (+off)
  const timerCap = computeTimerCap(bloco);

  return (
    <div
      className={cn(
        'rounded-[16px] border-2 bg-surface p-4 transition-all',
        done && 'opacity-50',
        current && !done ? 'shadow-md' : '',
      )}
      style={{
        borderColor: current && !done ? colors.bg : undefined,
        boxShadow: current && !done ? `0 0 0 1px ${colors.bg}33` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1.5 min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono">
            #{index + 1}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.6px] font-bold text-mono"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {FORMATO_LABEL[bloco.formato]}
            </span>
            {isRun && bloco.distanciaM !== undefined && (
              <span className="text-[20px] font-bold tabular leading-none text-ink text-mono">
                {bloco.distanciaM >= 1000
                  ? `${(bloco.distanciaM / 1000).toFixed(bloco.distanciaM % 1000 === 0 ? 0 : 2)}km`
                  : `${bloco.distanciaM}m`}
              </span>
            )}
            {bloco.duracaoSeg !== undefined && !isRun && (
              <span className="text-[20px] font-bold tabular leading-none text-ink text-mono">
                {formatDuracao(bloco.duracaoSeg)}
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
          aria-label={done ? 'Desmarcar bloco' : 'Marcar bloco como concluído'}
          aria-pressed={done}
        >
          ✓
        </button>
      </div>

      {/* Cronômetro visual para AMRAP/EMOM/TABATA/INTERVAL/FOR_TIME */}
      {hasTimer && timerCap !== null && (
        <Cronometro capSeg={timerCap} accent={colors.bg} />
      )}

      {/* Run: mostrar pace alvo */}
      {isRun && bloco.ritmoAlvoMinKm && (
        <div className="rounded-[10px] bg-bg border-2 border-app-strong p-2.5 mb-3 flex items-center justify-around">
          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono mb-0.5">
              Pace alvo
            </div>
            <div className="text-[22px] font-bold tabular leading-none text-mono text-ink">
              {bloco.ritmoAlvoMinKm}
              <span className="text-[10px] text-ink-muted ml-1">/km</span>
            </div>
          </div>
        </div>
      )}

      {/* INTERVAL/EMOM: rounds + on/off */}
      {(bloco.rounds !== undefined ||
        bloco.intervaloOnSeg !== undefined ||
        bloco.intervaloOffSeg !== undefined) && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {bloco.rounds !== undefined && (
            <Stat label="Rounds" value={String(bloco.rounds)} />
          )}
          {bloco.intervaloOnSeg !== undefined && (
            <Stat label="On" value={`${bloco.intervaloOnSeg}s`} />
          )}
          {bloco.intervaloOffSeg !== undefined && (
            <Stat label="Off" value={`${bloco.intervaloOffSeg}s`} />
          )}
        </div>
      )}

      {/* Lista de exercícios para STATION/AMRAP/EMOM/FOR_TIME */}
      {bloco.exercicios && bloco.exercicios.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {bloco.exercicios.map((ex, i) => (
            <ExercicioRow key={i} ex={ex} />
          ))}
        </div>
      )}

      {/* Realizado por bloco — tempo OU reps */}
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-app">
        <SmallField
          label="Tempo realizado"
          value={
            realizado?.tempoSeg !== undefined ? formatDuracao(realizado.tempoSeg) : ''
          }
          onChange={onTempo}
          placeholder="MM:SS"
        />
        <SmallField
          label="Reps feitas"
          value={realizado?.reps !== undefined ? String(realizado.reps) : ''}
          onChange={onReps}
          placeholder="—"
          type="number"
        />
      </div>

      {bloco.descansoEntreSeg !== undefined && bloco.descansoEntreSeg > 0 && (
        <div className="mt-2 text-[11px] text-ink-subtle text-mono uppercase tracking-[0.5px] font-bold">
          Descanso pós-bloco: {formatDuracaoCurto(bloco.descansoEntreSeg)}
        </div>
      )}
      {bloco.observacao && (
        <div className="mt-2 text-[12px] text-ink-muted italic">{bloco.observacao}</div>
      )}
    </div>
  );
}

function ExercicioRow({ ex }: { ex: HyroxExercicio }) {
  const nome = ex.nome ?? HYROX_MOV_LABEL[ex.movimento];
  const meta: string[] = [];
  if (ex.distanciaM !== undefined) meta.push(`${ex.distanciaM}m`);
  if (ex.repeticoes !== undefined) meta.push(`${ex.repeticoes} reps`);
  if (ex.duracaoSeg !== undefined) meta.push(formatDuracao(ex.duracaoSeg));
  const carga = ex.carga
    ? [
        ex.carga.open !== undefined ? `Open ${ex.carga.open}${ex.carga.unidade ?? 'kg'}` : null,
        ex.carga.pro !== undefined ? `Pro ${ex.carga.pro}${ex.carga.unidade ?? 'kg'}` : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-[10px] bg-surface-muted">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-ink truncate">{nome}</div>
        {carga && (
          <div className="text-[10px] text-ink-subtle text-mono uppercase tracking-[0.5px] font-bold">
            {carga}
          </div>
        )}
      </div>
      {meta.length > 0 && (
        <div className="text-[14px] font-bold tabular text-mono text-ink flex-shrink-0">
          {meta.join(' · ')}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cronômetro — countdown se cap, senão count-up
// ─────────────────────────────────────────────────────────────
function Cronometro({ capSeg, accent }: { capSeg: number; accent: string }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= capSeg) {
          setRunning(false);
          return capSeg;
        }
        return e + 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [running, capSeg]);

  const restante = Math.max(0, capSeg - elapsed);
  const pct = Math.min(100, (elapsed / capSeg) * 100);
  const finished = elapsed >= capSeg;

  function reset() {
    setRunning(false);
    setElapsed(0);
  }

  return (
    <div className="rounded-[12px] bg-bg border-2 border-app-strong p-3 mb-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-[9px] uppercase tracking-[0.7px] font-bold text-ink-subtle text-mono">
          Cronômetro {finished ? '· Tempo!' : ''}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            disabled={finished}
            className="px-3 h-8 rounded-[8px] bg-ink text-bg text-[11px] uppercase tracking-wider font-bold disabled:opacity-40"
          >
            {running ? 'Pausar' : finished ? 'Fim' : 'Iniciar'}
          </button>
          <button
            type="button"
            onClick={reset}
            className="px-3 h-8 rounded-[8px] bg-surface-muted text-ink-muted text-[11px] uppercase tracking-wider font-bold border border-app"
          >
            Reset
          </button>
        </div>
      </div>
      <div className="text-[36px] font-bold tabular leading-none text-mono text-ink mb-2">
        {formatDuracao(restante)}
      </div>
      <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: accent }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
function BigStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.6px] font-bold opacity-70 text-mono mb-1.5">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[32px] font-bold tabular leading-none text-mono">{value}</span>
        {suffix && <span className="text-[14px] opacity-70 font-bold">{suffix}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.5px] font-bold text-ink-subtle text-mono mb-1">
        {label}
      </div>
      <div className="text-[18px] font-bold tabular leading-none text-mono text-ink">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-[12px] bg-surface border border-app-strong text-ink text-mono text-[16px] font-bold tabular outline-none focus:border-accent"
      />
    </label>
  );
}

function SmallField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] font-bold uppercase tracking-[0.5px] text-ink-subtle text-mono mb-1">
        {label}
      </span>
      <input
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-2.5 rounded-[10px] bg-surface border border-app-strong text-ink text-mono text-[14px] font-bold tabular outline-none focus:border-accent"
      />
    </label>
  );
}

// ── Helpers ─────────────────────────────────────────────────────
function computeTimerCap(b: HyroxBloco): number | null {
  if (b.duracaoSeg !== undefined && b.duracaoSeg > 0) return b.duracaoSeg;
  if (b.formato === 'EMOM' && b.rounds !== undefined) return b.rounds * 60;
  if (b.formato === 'TABATA' && b.rounds !== undefined) return b.rounds * 30;
  if (
    b.formato === 'INTERVAL' &&
    b.rounds !== undefined &&
    b.intervaloOnSeg !== undefined
  ) {
    const off = b.intervaloOffSeg ?? 0;
    return b.rounds * (b.intervaloOnSeg + off);
  }
  return null;
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
