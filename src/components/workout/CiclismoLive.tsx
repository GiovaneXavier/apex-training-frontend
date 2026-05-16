import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import { salvarExecucaoOfflineFirst } from '@/lib/api/execucao';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  CiclismoBloco,
  DetalhesCiclismo,
  Treino,
  ZonaFTP,
} from '@/types/treino';
import { ZONA_FTP_DESCR } from '@/types/treino';

type Props = { treino: Treino };

// ─────────────────────────────────────────────────────────────
// Sistema de cores das 7 zonas de FTP (Coggan)
//   Z1 cinza   → Recuperação
//   Z2 azul    → Endurance
//   Z3 verde   → Tempo
//   Z4 amarelo → Threshold
//   Z5 laranja → VO2 Max
//   Z6 laranja-forte → Anaeróbico
//   Z7 vermelho      → Sprint / Neuromuscular
// ─────────────────────────────────────────────────────────────
const ZONA_COLORS: Record<ZonaFTP, { bg: string; text: string }> = {
  1: { bg: '#9ca3af', text: '#ffffff' },
  2: { bg: '#3b82f6', text: '#ffffff' },
  3: { bg: '#10b981', text: '#ffffff' },
  4: { bg: '#eab308', text: '#1f2937' },
  5: { bg: '#f97316', text: '#ffffff' },
  6: { bg: '#dc2626', text: '#ffffff' },
  7: { bg: '#7f1d1d', text: '#ffffff' },
};

const BLOCO_LABEL: Record<CiclismoBloco['tipo'], string> = {
  aquecimento: 'Aquecimento',
  intervalo: 'Intervalo',
  recuperacao: 'Recuperação',
  continuo: 'Contínuo',
  volta_calma: 'Volta calma',
  sprint: 'Sprint',
};

export function CiclismoLive({ treino }: Props) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const detalhes = treino.detalhes as DetalhesCiclismo;
  const realizadoAtual = detalhes.realizado ?? null;
  const blocos = detalhes.blocos ?? [];
  const ftp = detalhes.ftpW;

  const [distanciaKm, setDistanciaKm] = useState<string>(
    realizadoAtual?.distanciaKm !== undefined ? String(realizadoAtual.distanciaKm) : '',
  );
  const [duracao, setDuracao] = useState<string>(
    realizadoAtual?.duracaoSeg !== undefined ? formatDuracao(realizadoAtual.duracaoSeg) : '',
  );
  const [potenciaMedia, setPotenciaMedia] = useState<string>(
    realizadoAtual?.potenciaMediaW !== undefined ? String(realizadoAtual.potenciaMediaW) : '',
  );
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

    if (!distanciaKm && !duracao) {
      setError('Informe ao menos distância ou tempo realizado');
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
          distanciaKm: distanciaKm ? Number(distanciaKm) : undefined,
          duracaoSeg: duracaoSeg ?? undefined,
          potenciaMediaW: potenciaMedia ? Number(potenciaMedia) : undefined,
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

  // Bloco "atual" para destaque visual = primeiro ainda não concluído
  const blocoAtualIdx = blocos.findIndex((_, i) => !blocosConcluidos.has(i));

  return (
    <div className="min-h-screen bg-bg text-ink pb-12">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <button
          onClick={() => navigate('/aluno/dashboard')}
          className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Voltar
        </button>
        <span
          className={cn(
            'text-mono text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
            theme === 'dark' ? 'bg-accent text-accent-ink' : 'bg-ink text-bg',
          )}
        >
          Ciclismo
        </span>
      </header>

      <div className="px-5">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
          {formatDate(treino.dataAlvo)}
        </div>
        <h1 className="text-[24px] font-bold tracking-tight leading-tight mb-5">
          {treino.titulo}
        </h1>

        {/* CARD HERO: meta principal com números enormes (legíveis pedalando) */}
        <div className="rounded-[18px] bg-ink text-bg p-5 mb-5">
          <div className="text-[10px] uppercase tracking-[0.7px] font-bold opacity-70 text-mono mb-3">
            Meta do Treino
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {detalhes.distanciaKm !== undefined && (
              <BigStat label="Distância" value={String(detalhes.distanciaKm)} suffix="km" />
            )}
            {detalhes.duracaoMin !== undefined && (
              <BigStat label="Duração" value={String(detalhes.duracaoMin)} suffix="min" />
            )}
            {detalhes.potenciaAlvoW !== undefined && (
              <BigStat label="Potência" value={String(detalhes.potenciaAlvoW)} suffix="W" />
            )}
            {ftp !== undefined && (
              <BigStat label="FTP" value={String(ftp)} suffix="W" />
            )}
          </div>
        </div>

        {/* BLOCOS — cada um com badge de zona colorida e botão de check */}
        {blocos.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-mono text-[11px] uppercase tracking-[0.7px] font-bold text-ink-subtle">
                Blocos
              </div>
              <div className="text-mono text-[11px] tabular font-bold text-ink-muted">
                {blocosConcluidos.size}/{blocos.length}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {blocos.map((b, idx) => (
                <BlocoCard
                  key={idx}
                  bloco={b}
                  index={idx}
                  ftp={ftp}
                  done={blocosConcluidos.has(idx)}
                  current={idx === blocoAtualIdx}
                  onToggle={() => toggleBloco(idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* REALIZADO — inputs para finalizar */}
        <form onSubmit={onSubmit}>
          <div className="text-mono text-[11px] uppercase tracking-[0.7px] font-bold text-ink-subtle mb-3">
            Realizado
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2.5">
            <Field
              label="Distância (km)"
              value={distanciaKm}
              onChange={setDistanciaKm}
              placeholder={detalhes.distanciaKm ? String(detalhes.distanciaKm) : '—'}
              type="number"
              step="0.1"
            />
            <Field
              label="Tempo (HH:MM:SS)"
              value={duracao}
              onChange={setDuracao}
              placeholder={detalhes.duracaoMin ? `${Math.floor(detalhes.duracaoMin / 60)}:${pad(detalhes.duracaoMin % 60)}:00` : '1:30:00'}
            />
          </div>
          <div className="mb-3">
            <Field
              label="Potência média (W)"
              value={potenciaMedia}
              onChange={setPotenciaMedia}
              placeholder={detalhes.potenciaAlvoW ? String(detalhes.potenciaAlvoW) : '—'}
              type="number"
            />
          </div>

          {error && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-14 rounded-[14px] bg-accent text-accent-ink font-bold text-[15px] uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Salvando...' : (
              <>
                <span className="text-[18px] leading-none">✓</span>
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
// Subcomponentes
// ─────────────────────────────────────────────────────────────

function BlocoCard({
  bloco,
  index,
  ftp,
  done,
  current,
  onToggle,
}: {
  bloco: CiclismoBloco;
  index: number;
  ftp?: number;
  done: boolean;
  current: boolean;
  onToggle: () => void;
}) {
  const zona = bloco.zonaFTP;
  const colors = zona ? ZONA_COLORS[zona] : null;
  const zonaInfo = zona ? ZONA_FTP_DESCR[zona] : null;

  // Potência: usa alvoW direto, senão calcula a partir de FTP × pct
  const potenciaW =
    bloco.potenciaAlvoW ??
    (ftp && bloco.potenciaAlvoPctFTP
      ? Math.round((ftp * bloco.potenciaAlvoPctFTP) / 100)
      : undefined);

  return (
    <div
      className={cn(
        'rounded-[14px] border bg-surface p-4 transition-all',
        done && 'opacity-50',
        current && !done ? 'border-accent shadow-md' : 'border-app-strong',
      )}
      style={
        current && !done && colors
          ? { borderColor: colors.bg, boxShadow: `0 0 0 1px ${colors.bg}33` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono">
            #{index + 1} · {BLOCO_LABEL[bloco.tipo]}
          </div>
          {colors && zonaInfo ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.6px] font-bold text-mono w-fit"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              Z{zona} · {zonaInfo.nome}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex-shrink-0 size-11 rounded-full flex items-center justify-center text-[20px] font-bold transition-all border-2',
            done
              ? 'bg-accent text-accent-ink border-accent'
              : 'bg-surface text-ink-subtle border-app-strong hover:border-accent hover:text-ink',
          )}
          aria-label={done ? 'Desmarcar lap' : 'Marcar lap como concluída'}
          aria-pressed={done}
        >
          ✓
        </button>
      </div>

      {/* Números grandes para leitura no guidão */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-3">
        {potenciaW !== undefined && (
          <BigStatSm label="Potência" value={String(potenciaW)} suffix="W" highlight />
        )}
        {bloco.duracaoSeg !== undefined && (
          <BigStatSm label="Tempo" value={formatDuracao(bloco.duracaoSeg)} />
        )}
        {bloco.distanciaKm !== undefined && (
          <BigStatSm label="Distância" value={String(bloco.distanciaKm)} suffix="km" />
        )}
        {bloco.cadenciaRpm !== undefined && (
          <BigStatSm label="Cadência" value={String(bloco.cadenciaRpm)} suffix="rpm" />
        )}
        {bloco.repeticoes !== undefined && bloco.repeticoes > 1 && (
          <BigStatSm label="Reps" value={`${bloco.repeticoes}×`} />
        )}
        {bloco.recuperacaoSeg !== undefined && (
          <BigStatSm label="Recup." value={formatDuracao(bloco.recuperacaoSeg)} />
        )}
      </div>

      {zonaInfo && (
        <div className="mt-3 text-[10px] text-ink-subtle text-mono uppercase tracking-[0.5px] font-bold">
          {zonaInfo.pct} · {zonaInfo.desc}
        </div>
      )}
      {bloco.observacao && (
        <div className="mt-2 text-[12px] text-ink-muted italic">{bloco.observacao}</div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
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

function BigStatSm({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.5px] font-bold text-ink-subtle text-mono mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span
          className={cn(
            'tabular leading-none text-mono font-bold',
            highlight ? 'text-[24px] text-ink' : 'text-[20px] text-ink',
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[10px] text-ink-muted font-bold">{suffix}</span>
        )}
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
      <span className="block text-[9px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
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

// ─────────────────────────────────────────────────────────────
// Helpers de tempo (espelho de CorridaLive — mantidos locais)
// ─────────────────────────────────────────────────────────────
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

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
