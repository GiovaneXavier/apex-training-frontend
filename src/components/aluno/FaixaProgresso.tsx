import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import {
  FAIXA_COR,
  FAIXA_LABEL,
  getJornadaMarcial,
  registrarPromocao,
  type Faixa,
  type Jornada,
  type PromocaoInput,
} from '@/lib/api/marcial';
import { cn } from '@/lib/utils';

// PR #24 — Visualização da Jornada do Faixa Preta.
//
// Composição:
//   1. <FaixaVisual /> — a tarja colorida com pontinha preta + stripes
//      brancas representando o grauNum (0..4).
//   2. Bloco de métricas — tempo de tatame na faixa, próxima faixa,
//      barra de progresso preenchida.
//   3. Empty state quando o atleta não tem promoção registrada:
//      CTA "Registrar faixa" que abre form inline.
//
// O componente cuida do próprio fetch (jornada agregada). Plugar em
// /aluno/perfil ou /aluno/progresso só passa `alunoId` opcional pra
// professor abrir a jornada de um aluno vinculado.

type Props = { alunoId?: string };

const FAIXAS_ORDEM: Faixa[] = [
  'BRANCA', 'AZUL', 'ROXA', 'MARROM', 'PRETA', 'CORAL', 'VERMELHA',
];

export function FaixaProgresso({ alunoId }: Props) {
  const [jornada, setJornada] = useState<Jornada | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  async function recarregar(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const j = await getJornadaMarcial(alunoId, { signal });
      setJornada(j);
    } catch (err) {
      if (isCancelError(err)) return;
      setError(apiErrorMessage(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    void recarregar(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoId]);

  if (loading) {
    return (
      <div className="px-4 py-6 rounded-[16px] bg-surface border border-app text-center text-ink-muted text-[13px]">
        Carregando jornada…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
        {error}
      </div>
    );
  }

  if (!jornada?.faixaAtual) {
    return (
      <div className="p-5 rounded-[16px] bg-surface border border-dashed border-app-strong">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
          Jornada marcial
        </div>
        <div className="text-[14px] text-ink mb-1">Sem promoção registrada</div>
        <div className="text-[12px] text-ink-muted mb-4">
          Registre sua faixa atual pra começar a acompanhar a evolução até a próxima graduação.
        </div>
        {!mostrarForm ? (
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-[10px] bg-accent text-accent-ink"
          >
            + Registrar faixa
          </button>
        ) : (
          <FormPromocao
            alunoId={alunoId}
            onCancel={() => setMostrarForm(false)}
            onSaved={() => { setMostrarForm(false); recarregar(); }}
          />
        )}
      </div>
    );
  }

  const { faixaAtual, matTimeNaFaixaSeg, proximaFaixa, metaSegundos, progressoPct } = jornada;
  const horasNaFaixa = matTimeNaFaixaSeg / 3600;
  const metaHoras = metaSegundos ? metaSegundos / 3600 : null;

  return (
    <div className="rounded-[16px] bg-surface border border-app p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
          Faixa atual · {FAIXA_LABEL[faixaAtual.faixa]}
        </div>
        <button
          type="button"
          onClick={() => setMostrarForm(true)}
          className="text-[10px] uppercase tracking-wider font-bold text-accent"
        >
          + Promoção
        </button>
      </div>

      <FaixaVisual faixa={faixaAtual.faixa} grauNum={faixaAtual.grauNum} />

      <div className="mt-4 flex items-baseline justify-between">
        <div>
          <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
            Tempo de tatame na faixa
          </div>
          <div className="text-mono text-[22px] font-bold tabular text-ink leading-none">
            {fmtHorasCompactas(horasNaFaixa)}
          </div>
        </div>
        {proximaFaixa && metaHoras != null && (
          <div className="text-right">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
              Próxima · {FAIXA_LABEL[proximaFaixa]}
            </div>
            <div className="text-mono text-[13px] font-bold tabular text-ink-muted">
              meta {Math.round(metaHoras)}h
            </div>
          </div>
        )}
      </div>

      {proximaFaixa && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-bg overflow-hidden border border-app">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progressoPct}%` }}
              data-testid="barra-progresso"
              aria-valuenow={progressoPct}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
              aria-label={`Progresso para ${FAIXA_LABEL[proximaFaixa]}`}
            />
          </div>
          <div className="mt-1 text-mono text-[10px] text-ink-subtle font-bold tracking-wider text-right">
            {progressoPct}%
          </div>
        </div>
      )}

      {!proximaFaixa && (
        <div className="mt-3 text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-accent">
          ✦ Endgame — sem meta automática (graus internos)
        </div>
      )}

      {faixaAtual.instrutorNome && (
        <div className="mt-3 text-[11px] text-ink-muted">
          Promovido por <strong>{faixaAtual.instrutorNome}</strong> em{' '}
          {new Date(faixaAtual.dataPromocao).toLocaleDateString('pt-BR')}
        </div>
      )}

      {mostrarForm && (
        <div className="mt-4 pt-4 border-t border-app">
          <FormPromocao
            alunoId={alunoId}
            onCancel={() => setMostrarForm(false)}
            onSaved={() => { setMostrarForm(false); recarregar(); }}
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Visual da faixa: tarja colorida + ponteira preta com stripes brancas
// ─────────────────────────────────────────────────────────────────────

export function FaixaVisual({
  faixa, grauNum, height = 28,
}: {
  faixa: Faixa;
  grauNum: number;
  height?: number;
}) {
  const cor = FAIXA_COR[faixa];
  // Branca/Coral/Vermelha precisam de contraste extra (borda).
  const precisaBorda = faixa === 'BRANCA';

  return (
    <div
      className={cn(
        'relative w-full rounded-[6px] overflow-hidden flex',
        precisaBorda && 'border border-app-strong',
      )}
      style={{ height }}
      data-testid="faixa-visual"
      aria-label={`Faixa ${FAIXA_LABEL[faixa]} ${grauNum} grau${grauNum === 1 ? '' : 's'}`}
    >
      {/* Corpo da faixa */}
      <div className="flex-1" style={{ backgroundColor: cor }} />

      {/* Ponteira preta com stripes brancas (tatame real: ponteira
          ocupa ~20% da faixa). Vermelha/Coral/Preta já são escuras —
          a ponteira mantém preta pra coerência visual. */}
      <div className="relative w-[22%] bg-black flex items-center justify-around px-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-[60%] w-[3px] rounded-[1px]',
              i < grauNum ? 'bg-white' : 'bg-white/15',
            )}
            data-testid={`stripe-${i}`}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Form inline de nova promoção
// ─────────────────────────────────────────────────────────────────────

function FormPromocao({
  alunoId, onCancel, onSaved,
}: {
  alunoId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [faixa, setFaixa] = useState<Faixa>('BRANCA');
  const [grauNum, setGrauNum] = useState<number>(0);
  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [instrutor, setInstrutor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const input: PromocaoInput = {
        alunoId,
        faixa,
        grauNum,
        dataPromocao: new Date(data + 'T12:00:00').toISOString(),
        instrutorNome: instrutor.trim() || undefined,
      };
      await registrarPromocao(input);
      toast.success(`Promoção registrada · ${FAIXA_LABEL[faixa]}`);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
        Nova promoção
      </div>

      <label className="block text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Faixa</label>
      <select
        value={faixa}
        onChange={(e) => setFaixa(e.target.value as Faixa)}
        className="w-full h-10 px-3 mb-2 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
      >
        {FAIXAS_ORDEM.map((f) => (
          <option key={f} value={f}>{FAIXA_LABEL[f]}</option>
        ))}
      </select>

      <label className="block text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
        Graus · {grauNum}/4
      </label>
      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={grauNum}
        onChange={(e) => setGrauNum(Number(e.target.value))}
        data-testid="grauNum-slider"
        className="w-full accent-coral mb-2"
        aria-label="Graus (0 a 4)"
      />

      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          required
          className="h-10 px-3 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
        />
        <input
          type="text"
          placeholder="Instrutor (opcional)"
          maxLength={120}
          value={instrutor}
          onChange={(e) => setInstrutor(e.target.value)}
          className="h-10 px-3 rounded-[10px] bg-bg border border-app-strong text-ink text-[13px]"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 h-10 rounded-[10px] bg-surface border border-app-strong text-ink-muted text-[11px] font-bold uppercase tracking-wider"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 h-10 rounded-[10px] bg-accent text-accent-ink text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : 'Salvar promoção'}
        </button>
      </div>
    </form>
  );
}

// Compacta horas — "123h" abaixo de 1000h, "1.2k h" acima.
export function fmtHorasCompactas(horas: number): string {
  if (horas < 1) return '< 1h';
  if (horas < 1000) return `${Math.round(horas)}h`;
  return `${(horas / 1000).toFixed(1)}k h`;
}
