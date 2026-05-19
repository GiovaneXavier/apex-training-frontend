import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import { parseBjjAudio, type VoiceExtractResult } from '@/lib/api/voice';
import { enqueueVoicePending } from '@/lib/offline/saveQueue';
import { saveDraft } from '@/lib/offline/voiceDrafts';
import { cn } from '@/lib/utils';

// PR #25 — Diário de Voz: gravação + processamento IA.
//
// FSM estados:
//   idle       → atleta abriu, ainda não permitiu mic
//   recording  → MediaRecorder ativo
//   processing → blob → backend → LLM
//   review     → fields prontos pra hidratar form pai
//   error      → exibe mensagem + permite retry
//
// Decisões:
//   - Limite hard 90s gravação. Atleta verboso é desnecessário; rola é
//     evento pontual. Auto-stop com countdown nos últimos 10s.
//   - Offline = enfileira + cria draft local imediato (UX otimista) +
//     fecha modal. Drain processa depois e atualiza o draft com fields
//     reais; banner aparece no próximo mount.
//   - Lazy: este arquivo é importado via React.lazy em JiuJitsuLive. Não
//     entra no bundle inicial.

type Props = {
  treinoId: string;
  onApply: (result: VoiceExtractResult) => void;
  onClose: () => void;
};

type State =
  | { kind: 'idle' }
  | { kind: 'recording'; startedAt: number }
  | { kind: 'processing' }
  | { kind: 'review'; result: VoiceExtractResult }
  | { kind: 'error'; message: string };

const MAX_RECORDING_MS = 90_000;
const COUNTDOWN_AT_MS = 10_000; // mostra countdown nos últimos 10s

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  // Ordem: webm (Chrome/Android/desktop Safari recente) → mp4 (iOS) →
  // ogg (Firefox antigo). MediaRecorder.isTypeSupported pode retornar
  // false em todos no Safari iOS < 14.5 — aí desistimos.
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

export function VoiceDiary({ treinoId, onApply, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);

  // Cleanup completo — para todo stream/recorder/ticker. Chamado em
  // unmount e em transições críticas (cancel, error, processed).
  function cleanup() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* já parado */ }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (tickerRef.current != null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    if (autoStopRef.current != null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }

  useEffect(() => cleanup, []);

  async function start() {
    const mimeType = pickMimeType();
    if (!mimeType) {
      setState({ kind: 'error', message: 'Gravação de áudio não suportada neste navegador. Tente Chrome ou Edge.' });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err instanceof Error && err.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Habilite nas configurações do site.'
        : 'Não foi possível acessar o microfone.';
      setState({ kind: 'error', message: msg });
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.addEventListener('dataavailable', (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    });
    recorder.addEventListener('stop', () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      void process(blob);
    });

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();

    const startedAt = Date.now();
    setState({ kind: 'recording', startedAt });
    setElapsedMs(0);

    tickerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);

    autoStopRef.current = window.setTimeout(() => {
      stop();
    }, MAX_RECORDING_MS);
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (tickerRef.current != null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    if (autoStopRef.current != null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    setState({ kind: 'processing' });
  }

  function cancel() {
    cleanup();
    setState({ kind: 'idle' });
  }

  async function process(blob: Blob) {
    if (blob.size === 0) {
      setState({ kind: 'error', message: 'Gravação vazia. Tente de novo.' });
      cleanup();
      return;
    }

    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if (offline) {
      // Offline: enfileira pro drain processar depois. Fecha o modal,
      // banner aparecerá no próximo mount do treino (após drain).
      try {
        await enqueueVoicePending(treinoId, blob);
        toast.success('Áudio salvo · processado quando voltar a rede');
        cleanup();
        onClose();
      } catch (err) {
        setState({ kind: 'error', message: apiErrorMessage(err) });
      }
      return;
    }

    try {
      const result = await parseBjjAudio(blob, treinoId);
      // Defesa-em-profundidade: persiste rascunho mesmo em fluxo síncrono.
      // Se atleta fechar a modal antes de aplicar, recupera no próximo mount.
      await saveDraft(treinoId, {
        fields: result.fields,
        transcript: result.transcript,
        confidence: result.confidence,
        needsReview: result.needsReview,
        warnings: result.warnings,
        partial: result.partial,
      });
      setState({ kind: 'review', result });
    } catch (err) {
      setState({ kind: 'error', message: apiErrorMessage(err) });
    } finally {
      cleanup();
    }
  }

  function apply() {
    if (state.kind !== 'review') return;
    onApply(state.result);
  }

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-label="Diário de Voz"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-bg/95 flex items-center justify-center p-5"
    >
      <div className="w-full max-w-sm bg-surface border border-app-strong rounded-[16px] p-5">
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold">Diário de Voz</h2>
          <button
            type="button"
            onClick={() => { cleanup(); onClose(); }}
            className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        {state.kind === 'idle' && (
          <div className="text-center">
            <p className="text-[13px] text-ink-muted mb-4">
              Dite seu relato pós-rola: tempo no tatame, rounds, finalizações, como se sentiu.
              Máximo 90s.
            </p>
            <button
              type="button"
              onClick={start}
              data-testid="voice-start"
              className="h-14 w-14 rounded-full bg-accent text-accent-ink text-[22px] mx-auto flex items-center justify-center"
              aria-label="Iniciar gravação"
            >
              🎙️
            </button>
          </div>
        )}

        {state.kind === 'recording' && (
          <RecordingView elapsedMs={elapsedMs} onStop={stop} onCancel={cancel} />
        )}

        {state.kind === 'processing' && (
          <div className="text-center py-6" data-testid="voice-processing">
            <div className="text-[28px] mb-2">🤖</div>
            <p className="text-[13px] text-ink-muted">Processando seu relato…</p>
          </div>
        )}

        {state.kind === 'review' && (
          <ReviewView result={state.result} onApply={apply} onCancel={cancel} />
        )}

        {state.kind === 'error' && (
          <div className="text-center py-6" data-testid="voice-error">
            <p className="text-[13px] text-danger mb-4">{state.message}</p>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordingView({
  elapsedMs, onStop, onCancel,
}: { elapsedMs: number; onStop: () => void; onCancel: () => void }) {
  const remaining = Math.max(0, MAX_RECORDING_MS - elapsedMs);
  const showCountdown = remaining <= COUNTDOWN_AT_MS;

  return (
    <div className="text-center" data-testid="voice-recording">
      <div className="text-[28px] mb-2 animate-pulse" aria-hidden>🔴</div>
      <div className="text-mono text-[28px] tabular font-bold mb-1">
        {formatTimer(elapsedMs)}
      </div>
      {showCountdown && (
        <div className="text-mono text-[11px] text-danger font-bold mb-3">
          {Math.ceil(remaining / 1000)}s restantes
        </div>
      )}
      <div className="flex gap-3 justify-center mt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 h-11 rounded-[12px] bg-surface border border-app text-ink-muted text-[12px] font-bold uppercase tracking-wider"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onStop}
          data-testid="voice-stop"
          className="px-5 h-11 rounded-[12px] bg-accent text-accent-ink text-[12px] font-bold uppercase tracking-wider"
        >
          Parar
        </button>
      </div>
    </div>
  );
}

function ReviewView({
  result, onApply, onCancel,
}: { result: VoiceExtractResult; onApply: () => void; onCancel: () => void }) {
  const { fields, confidence, needsReview, warnings } = result;
  const fieldEntries: Array<[string, string | number]> = [];
  if (fields.matTimeSegundos != null) fieldEntries.push(['Tempo (s)', fields.matTimeSegundos]);
  if (fields.roundsCompletos != null) fieldEntries.push(['Rounds', fields.roundsCompletos]);
  if (fields.finalizacoesFeitas != null) fieldEntries.push(['Finalizações feitas', fields.finalizacoesFeitas]);
  if (fields.finalizacoesSofridas != null) fieldEntries.push(['Finalizações sofridas', fields.finalizacoesSofridas]);
  if (fields.readinessRating != null) fieldEntries.push(['Readiness', fields.readinessRating]);
  if (fields.observacao) fieldEntries.push(['Observação', fields.observacao]);

  return (
    <div data-testid="voice-review">
      <div className="text-[12px] text-ink-muted mb-3">
        IA extraiu os campos abaixo. Você pode aplicar e ajustar no formulário, ou cancelar.
      </div>
      {needsReview && (
        <div className={cn(
          'mb-3 px-3 py-2 rounded-[10px] bg-warn-bg text-warn text-[11px] font-medium',
          'border border-warn/30',
        )}>
          Confiança {Math.round(confidence * 100)}%. Revise os valores antes de aplicar.
        </div>
      )}
      {fieldEntries.length === 0 ? (
        <p className="text-[12px] text-ink-subtle italic mb-3">Nenhum campo identificado no áudio.</p>
      ) : (
        <dl className="space-y-1.5 mb-3 text-[13px]">
          {fieldEntries.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-app pb-1">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="text-ink font-bold text-mono tabular">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {warnings.length > 0 && (
        <ul className="text-[11px] text-warn mb-3 list-disc pl-4">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 rounded-[12px] bg-surface border border-app text-ink-muted text-[12px] font-bold uppercase tracking-wider"
        >
          Descartar
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={fieldEntries.length === 0}
          data-testid="voice-apply"
          className="flex-1 h-11 rounded-[12px] bg-accent text-accent-ink text-[12px] font-bold uppercase tracking-wider disabled:opacity-40"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export default VoiceDiary;
