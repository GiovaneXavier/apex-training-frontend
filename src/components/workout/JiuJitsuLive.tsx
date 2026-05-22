import { FormEvent, lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { salvarExecucaoOfflineFirst } from '@/lib/api/execucao';
import type { VoiceExtractResult } from '@/lib/api/voice';
import { clearDraft, getDraft, type VoiceDraft } from '@/lib/offline/voiceDrafts';
import { cn } from '@/lib/utils';
import type {
  DetalhesJiuJitsu,
  DetalhesJiuJitsuRealizado,
  Treino,
} from '@/types/treino';

// VoiceDiary é chunk separado — só carrega quando o atleta clica "🎙️".
// MediaRecorder API é nativa, sem polyfill, então o chunk fica pequeno
// (~3-5 KB Gzip). Bundle inicial não cresce.
const VoiceDiary = lazy(() => import('./VoiceDiary'));

// PR #23 — Diário de Tatame (pós-rola).
//
// Filosofia: fricção zero. Atleta saiu do tatame, suado, cansado,
// quer registrar e ir pro banho. Sem cronômetro correndo na tela
// (não somos app de TÉCNICA — somos app de RELATO).
//
// Layout otimizado pra polegar:
//   - matTime: input MM:SS / HH:MM:SS (mesma UX do CorridaLive)
//   - rounds + finalizações: botões +/- gigantes (sem teclado virtual)
//   - readiness: slider 1-10 com label dinâmico
//   - observação: textarea opcional pra "lembrete do dia"
//   - salvar: offline-first (drena no Wi-Fi do vestiário)

type Props = { treino: Treino };

const READINESS_LABELS: Record<number, string> = {
  1: 'Arrasado', 2: 'Muito cansado', 3: 'Cansado', 4: 'Esgotado-OK',
  5: 'Neutro', 6: 'Bem', 7: 'Bem disposto', 8: 'Forte',
  9: 'Muito forte', 10: 'Pico',
};

export function JiuJitsuLive({ treino }: Props) {
  const navigate = useNavigate();
  const detalhes = treino.detalhes as DetalhesJiuJitsu;
  const realizadoAtual = detalhes.realizado ?? null;

  // Pré-preenche da prescrição quando faz sentido (tempo previsto da rola
  // = rounds × tempoRoundSeg). Atleta ajusta com +/- ou troca matTime.
  const matTimeSugerido = detalhes.rolas
    ? detalhes.rolas.rounds * detalhes.rolas.tempoRoundSeg
    : 0;

  const [matTime, setMatTime] = useState<string>(
    realizadoAtual?.matTimeSegundos != null
      ? formatDuracao(realizadoAtual.matTimeSegundos)
      : matTimeSugerido > 0
      ? formatDuracao(matTimeSugerido)
      : '',
  );
  const [rounds, setRounds] = useState<number>(
    realizadoAtual?.roundsCompletos ?? detalhes.rolas?.rounds ?? 0,
  );
  const [finalizacoesFeitas, setFinFeitas] = useState<number>(
    realizadoAtual?.finalizacoesFeitas ?? 0,
  );
  const [finalizacoesSofridas, setFinSofridas] = useState<number>(
    realizadoAtual?.finalizacoesSofridas ?? 0,
  );
  const [readiness, setReadiness] = useState<number>(
    realizadoAtual?.readinessRating ?? 7,
  );
  const [observacao, setObservacao] = useState<string>(
    realizadoAtual?.observacao ?? '',
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // PR #25 — Diário de Voz com IA.
  // - `voiceOpen` controla modal.
  // - `pendingDraft` é rascunho recuperado do IndexedDB (processado em
  //   background quando o componente estava desmontado). Banner aparece
  //   se setado; atleta decide aplicar ou descartar.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<VoiceDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const draft = await getDraft(treino.id);
      if (!cancelled) setPendingDraft(draft);
    })();
    return () => { cancelled = true; };
  }, [treino.id]);

  function applyVoiceFields(fields: VoiceExtractResult['fields']) {
    if (fields.matTimeSegundos != null) {
      setMatTime(formatDuracao(fields.matTimeSegundos));
    }
    if (fields.roundsCompletos != null) setRounds(fields.roundsCompletos);
    if (fields.finalizacoesFeitas != null) setFinFeitas(fields.finalizacoesFeitas);
    if (fields.finalizacoesSofridas != null) setFinSofridas(fields.finalizacoesSofridas);
    if (fields.readinessRating != null) setReadiness(fields.readinessRating);
    if (fields.observacao) setObservacao(fields.observacao);
  }

  async function onApplyVoice(result: VoiceExtractResult) {
    applyVoiceFields(result.fields);
    await clearDraft(treino.id);
    setPendingDraft(null);
    setVoiceOpen(false);
    toast.success('Campos preenchidos · revise e salve');
  }

  async function onApplyDraft() {
    if (!pendingDraft) return;
    applyVoiceFields(pendingDraft.fields);
    await clearDraft(treino.id);
    setPendingDraft(null);
    toast.success('Diário de voz aplicado');
  }

  async function onDiscardDraft() {
    if (!pendingDraft) return;
    await clearDraft(treino.id);
    setPendingDraft(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // matTime opcional: atleta esqueceu de marcar, mas quer registrar
    // rounds + readiness. Só validamos formato SE preenchido.
    let matTimeSeg: number | undefined;
    if (matTime.trim()) {
      const parsed = parseDuracao(matTime);
      if (parsed === null) {
        setError('Tempo de tatame inválido (use MM:SS ou HH:MM:SS)');
        return;
      }
      matTimeSeg = parsed;
    }

    setSubmitting(true);
    try {
      const realizado: DetalhesJiuJitsuRealizado = {
        matTimeSegundos: matTimeSeg,
        roundsCompletos: rounds > 0 ? rounds : undefined,
        finalizacoesFeitas: finalizacoesFeitas > 0 ? finalizacoesFeitas : undefined,
        finalizacoesSofridas: finalizacoesSofridas > 0 ? finalizacoesSofridas : undefined,
        readinessRating: readiness,
        observacao: observacao.trim() || undefined,
      };
      const result = await salvarExecucaoOfflineFirst(treino.id, {
        realizado: realizado as Record<string, unknown>,
        status: 'CONCLUIDO',
      });
      if (result.kind === 'queued') {
        toast.success('Treino salvo offline · sincroniza quando voltar a rede');
      } else {
        toast.success('Diário de tatame registrado 🥋');
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
          type="button"
          onClick={() => navigate('/aluno/dashboard')}
          className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
        >
          ← Dashboard
        </button>
        <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
          Jiu-Jitsu
        </span>
      </header>

      <div className="px-5 max-w-md mx-auto">
        <h1 className="text-[24px] font-bold tracking-tight mb-1">{treino.titulo}</h1>
        <p className="text-ink-muted text-sm mb-5">Diário de tatame · pós-rola</p>

        {/* PR #25 — Banner de rascunho processado em background.
            Aparece quando o atleta gravou voz offline, drenou em outra
            tela, e voltou pra este treino. */}
        {pendingDraft && (
          <div
            data-testid="voice-draft-banner"
            className="mb-4 p-3 rounded-[12px] bg-accent/5 border border-accent/30"
          >
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-accent font-bold mb-1">
              🎙️ Diário de voz processado
            </div>
            <p className="text-[12px] text-ink-muted mb-2">
              Encontramos um relato gravado offline já processado pela IA.
              Deseja aplicar?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onApplyDraft}
                data-testid="voice-draft-apply"
                className="flex-1 h-9 rounded-[10px] bg-accent text-accent-ink text-[11px] font-bold uppercase tracking-wider"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={onDiscardDraft}
                data-testid="voice-draft-discard"
                className="flex-1 h-9 rounded-[10px] bg-surface border border-app text-ink-muted text-[11px] font-bold uppercase tracking-wider"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {/* PR #25 — CTA pra abrir o Diário de Voz (lazy). Some quando
            o draft banner está exibido pra não competir visualmente. */}
        {!pendingDraft && (
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            data-testid="voice-open"
            className="w-full mb-4 h-11 rounded-[12px] bg-surface border border-accent/40 text-accent text-[12px] font-bold uppercase tracking-wider"
          >
            🎙️ Diário de voz (IA)
          </button>
        )}

        {/* Resumo da prescrição (se houver) */}
        {detalhes.rolas && (
          <div className="mb-5 p-3 rounded-[12px] bg-surface border border-app">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-1">
              Prescrição
            </div>
            <div className="text-[12.5px] text-ink-muted">
              {detalhes.rolas.rounds} rounds × {Math.round(detalhes.rolas.tempoRoundSeg / 60)} min
              {detalhes.rolas.descansoSeg ? ` · ${detalhes.rolas.descansoSeg}s descanso` : ''}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 px-3 py-2 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit}>
          {/* matTime — input livre MM:SS / HH:MM:SS */}
          <Label>Tempo de tatame</Label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="ex: 45:00 ou 1:30:00"
            value={matTime}
            onChange={(e) => setMatTime(e.target.value)}
            className="w-full h-12 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[18px] tabular text-mono mb-4"
          />

          {/* Rounds + Finalizações: +/- gigantes */}
          <Label>Rounds completos</Label>
          <Counter value={rounds} onChange={setRounds} max={50} testId="rounds" />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <Label>Finalizações feitas</Label>
              <Counter
                value={finalizacoesFeitas}
                onChange={setFinFeitas}
                max={50}
                accent="success"
                testId="fin-feitas"
              />
            </div>
            <div>
              <Label>Finalizações sofridas</Label>
              <Counter
                value={finalizacoesSofridas}
                onChange={setFinSofridas}
                max={50}
                accent="danger"
                testId="fin-sofridas"
              />
            </div>
          </div>

          {/* Readiness — slider 1..10 com label dinâmico */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between mb-1.5">
              <Label>Como você está?</Label>
              <span className="text-mono text-[11px] text-ink-subtle font-bold">
                {readiness}/10 · {READINESS_LABELS[readiness]}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={readiness}
              onChange={(e) => setReadiness(Number(e.target.value))}
              data-testid="readiness"
              className="w-full accent-coral"
              aria-label="Readiness 1 a 10"
            />
            <div className="flex justify-between text-[10px] text-ink-subtle text-mono">
              <span>1</span><span>5</span><span>10</span>
            </div>
          </div>

          {/* Observação opcional */}
          <div className="mt-5">
            <Label>Observação (opcional)</Label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Joelho travou no final, foco em abrir guarda fechada..."
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 rounded-[10px] bg-surface border border-app-strong text-ink text-[13px] resize-y"
            />
            <div className="text-right text-[10px] text-ink-subtle text-mono mt-1">
              {observacao.length}/500
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'w-full h-14 mt-5 rounded-[14px] bg-accent text-accent-ink font-bold text-[15px] uppercase tracking-wider',
              'disabled:opacity-50',
            )}
          >
            {submitting ? 'Salvando…' : 'Registrar treino'}
          </button>
        </form>
      </div>

      {voiceOpen && (
        <Suspense fallback={null}>
          <VoiceDiary
            treinoId={treino.id}
            onApply={onApplyVoice}
            onClose={() => setVoiceOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

// ─── Counter componente reusável ─────────────────────────────────────

function Counter({
  value, onChange, max = 50, accent, testId,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  accent?: 'success' | 'danger';
  testId?: string;
}) {
  const cor =
    accent === 'success' ? 'text-accent'
    : accent === 'danger' ? 'text-danger'
    : 'text-ink';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label="Diminuir"
        className="size-12 rounded-[12px] bg-surface border border-app-strong text-ink text-[20px] font-bold disabled:opacity-30"
      >
        −
      </button>
      <div
        data-testid={testId}
        className={cn(
          'flex-1 h-12 rounded-[12px] bg-surface border border-app flex items-center justify-center',
          'text-mono text-[24px] font-bold tabular tracking-tight',
          cor,
        )}
      >
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Aumentar"
        className="size-12 rounded-[12px] bg-surface border border-app-strong text-ink text-[20px] font-bold disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-1.5">
      {children}
    </div>
  );
}

// ─── Helpers de duração (espelhar CorridaLive) ───────────────────────

export function formatDuracao(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

export function parseDuracao(input: string): number | null {
  const parts = input.trim().split(':').map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 2) {
    const [m, s] = nums;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  if (nums.length === 3) {
    const [h, m, s] = nums;
    if (m >= 60 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
