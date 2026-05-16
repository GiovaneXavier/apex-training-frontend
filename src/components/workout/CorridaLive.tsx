import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { useTheme } from '@/contexts/ThemeContext';
import { apiErrorMessage } from '@/lib/api';
import { salvarExecucaoOfflineFirst } from '@/lib/api/execucao';
import { listAtividadesStrava, type AtividadeStrava } from '@/lib/api/strava';
import { formatDate, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DetalhesCorrida, Treino } from '@/types/treino';

type Props = {
  treino: Treino;
  alunoId?: string;
};

export function CorridaLive({ treino, alunoId }: Props) {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const detalhes = treino.detalhes as DetalhesCorrida;
  const realizadoAtual = detalhes.realizado ?? null;

  const [distanciaKm, setDistanciaKm] = useState<string>(
    realizadoAtual?.distanciaKm !== undefined ? String(realizadoAtual.distanciaKm) : '',
  );
  const [duracao, setDuracao] = useState<string>(
    realizadoAtual?.duracaoSeg !== undefined ? formatDuracao(realizadoAtual.duracaoSeg) : '',
  );
  const [fcMedia, setFcMedia] = useState<string>(
    realizadoAtual?.fcMedia !== undefined ? String(realizadoAtual.fcMedia) : '',
  );
  const [stravaId, setStravaId] = useState<string>(realizadoAtual?.stravaActivityId ?? '');

  const [stravaList, setStravaList] = useState<AtividadeStrava[] | null>(null);
  const [showStravaPicker, setShowStravaPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Calcula ritmo médio (mm:ss/km) a partir de distância + tempo
  const ritmoMedio = computeRitmo(distanciaKm, duracao);

  useEffect(() => {
    if (!alunoId || !showStravaPicker || stravaList !== null) return;
    listAtividadesStrava(alunoId, 30)
      .then((list) => setStravaList(list.filter((a) => a.tipo.toLowerCase().includes('run') || a.tipo === 'Run')))
      .catch(() => setStravaList([]));
  }, [alunoId, showStravaPicker, stravaList]);

  function applyStrava(a: AtividadeStrava) {
    setDistanciaKm((a.distanciaM / 1000).toFixed(2));
    setDuracao(formatDuracao(a.duracaoSeg));
    if (a.fcMedia) setFcMedia(String(a.fcMedia));
    setStravaId(a.stravaId);
    setShowStravaPicker(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!distanciaKm || !duracao) {
      setError('Informe distância e tempo');
      return;
    }
    const duracaoSeg = parseDuracao(duracao);
    if (!duracaoSeg) {
      setError('Tempo inválido (use MM:SS ou HH:MM:SS)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await salvarExecucaoOfflineFirst(treino.id, {
        realizado: {
          distanciaKm: Number(distanciaKm),
          duracaoSeg,
          ritmoMedioMinKm: ritmoMedio || undefined,
          fcMedia: fcMedia ? Number(fcMedia) : undefined,
          stravaActivityId: stravaId || undefined,
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

  return (
    <div className="min-h-screen bg-bg text-ink pb-10">
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
          Corrida
        </span>
      </header>

      <div className="px-5">
        <div className="text-mono text-[10px] uppercase tracking-[0.7px] text-ink-subtle font-bold mb-1">
          {formatDate(treino.dataAlvo)}
        </div>
        <h1 className="text-[24px] font-bold tracking-tight leading-tight mb-5">{treino.titulo}</h1>

        <div className="rounded-[16px] bg-ink text-bg p-4 mb-5">
          <div className="text-[10px] uppercase tracking-[0.6px] font-bold opacity-70 text-mono mb-2">
            Prescrição
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Distância" value={`${detalhes.distanciaKm}km`} />
            <Stat label="Ritmo alvo" value={detalhes.ritmoAlvoMinKm ? `${detalhes.ritmoAlvoMinKm}/km` : '—'} />
            <Stat
              label="FC alvo"
              value={
                detalhes.fcAlvoMin || detalhes.fcAlvoMax
                  ? `${detalhes.fcAlvoMin ?? '—'}-${detalhes.fcAlvoMax ?? '—'}`
                  : '—'
              }
            />
          </div>
        </div>

        {alunoId && (
          <button
            type="button"
            onClick={() => setShowStravaPicker((v) => !v)}
            className="w-full mb-3 h-11 rounded-[12px] bg-surface-muted text-ink text-[12px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border border-app-strong"
          >
            <span>⚡</span> {showStravaPicker ? 'Ocultar atividades Strava' : 'Importar do Strava'}
          </button>
        )}

        {showStravaPicker && (
          <StravaPicker list={stravaList} onPick={applyStrava} />
        )}

        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Field label="Distância (km)" value={distanciaKm} onChange={setDistanciaKm} placeholder={String(detalhes.distanciaKm)} type="number" step="0.01" />
            <Field label="Tempo (MM:SS)" value={duracao} onChange={setDuracao} placeholder="25:30" />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <ReadField label="Ritmo médio" value={ritmoMedio || '—'} suffix="/km" />
            <Field label="FC média" value={fcMedia} onChange={setFcMedia} placeholder="—" type="number" min={30} max={250} />
          </div>

          {stravaId && (
            <div className="text-[10px] text-ink-subtle font-mono uppercase tracking-wider mb-3">
              Vinculado à atividade Strava #{stravaId}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Finalizar treino'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.6px] font-bold opacity-60 text-mono mb-1">{label}</div>
      <div className="text-mono text-[16px] font-bold tabular leading-none">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', step, min, max }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; step?: string; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
        {label}
      </span>
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-[12px] bg-surface border border-app-strong text-ink text-mono text-[16px] font-bold tabular outline-none focus:border-accent"
      />
    </label>
  );
}

function ReadField({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-ink-subtle text-mono mb-1.5">
        {label}
      </div>
      <div className="h-12 px-3 rounded-[12px] bg-surface-muted text-ink-muted text-mono text-[16px] font-bold tabular flex items-center gap-1">
        {value}
        {value !== '—' && suffix && <span className="text-[11px] text-ink-subtle font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function StravaPicker({ list, onPick }: { list: AtividadeStrava[] | null; onPick: (a: AtividadeStrava) => void }) {
  if (list === null) {
    return <div className="mb-3 px-3 py-3 rounded-[12px] bg-surface border border-app text-ink-subtle text-[12px]">Carregando atividades...</div>;
  }
  if (list.length === 0) {
    return <div className="mb-3 px-3 py-3 rounded-[12px] bg-surface border border-app text-ink-subtle text-[12px]">Nenhuma corrida encontrada no Strava. Sincronize no perfil primeiro.</div>;
  }
  return (
    <div className="mb-3 flex flex-col gap-1.5 max-h-60 overflow-y-auto">
      {list.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onPick(a)}
          className="text-left px-3 py-2.5 rounded-[12px] bg-surface border border-app hover:border-accent transition-colors flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">{a.nome}</div>
            <div className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
              {a.tipo} · {relativeDay(a.iniciadoEm)}
            </div>
          </div>
          <div className="text-mono text-[12px] tabular text-ink font-bold flex-shrink-0">
            {(a.distanciaM / 1000).toFixed(1)}km
          </div>
        </button>
      ))}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────
function parseDuracao(input: string): number | null {
  const trimmed = input.trim();
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

function pad(n: number): string { return n.toString().padStart(2, '0'); }

function computeRitmo(distanciaKm: string, duracao: string): string {
  const km = Number(distanciaKm);
  const seg = parseDuracao(duracao);
  if (!km || !seg || km <= 0) return '';
  const segPorKm = seg / km;
  const m = Math.floor(segPorKm / 60);
  const s = Math.round(segPorKm % 60);
  return `${m}:${pad(s)}`;
}
