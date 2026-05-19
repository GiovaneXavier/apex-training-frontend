import { useState } from 'react';
import { toast } from 'sonner';

import { apiErrorMessage } from '@/lib/api';
import {
  postDraftTreino,
  type DraftExercicio,
  type DraftTreinoResponse,
} from '@/lib/api/aiDraft';
import { cn } from '@/lib/utils';

import { AIDraftExercicioPreview } from './AIDraftExercicioPreview';

// PR #30 — Modal lazy de geração IA.
//
// Estados:
//   prompt    → textarea + select aluno opcional + botão "Gerar"
//   loading   → consultando IA (~5-8s, com mensagem)
//   preview   → cards por dia, exercícios com semáforo, CTA "Aplicar"
//   error     → mensagem + retry
//
// onApply recebe o draft completo (todos os exercícios já hidratados
// com exercicioId quando disponível). Caller (Prescrever) decide como
// mapear pra ExerForm — escolhemos diasSugeridos[0] como o "treino que
// vai virar prescrição agora", restante fica como sugestão pra coach
// criar treinos adicionais.

type Props = {
  alunoId?: string;
  onApply: (draft: DraftTreinoResponse) => void;
  onClose: () => void;
};

type State =
  | { kind: 'prompt' }
  | { kind: 'loading' }
  | { kind: 'preview'; data: DraftTreinoResponse }
  | { kind: 'error'; message: string };

const MAX_PROMPT = 500;
const MIN_PROMPT = 3;

export function AIDraftModal({ alunoId, onApply, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'prompt' });
  const [prompt, setPrompt] = useState('');

  async function gerar() {
    if (prompt.trim().length < MIN_PROMPT) return;
    setState({ kind: 'loading' });
    try {
      const data = await postDraftTreino({ prompt, alunoId });
      setState({ kind: 'preview', data });
    } catch (err) {
      setState({ kind: 'error', message: apiErrorMessage(err) });
    }
  }

  function aplicar() {
    if (state.kind !== 'preview') return;
    onApply(state.data);
    toast.success('Draft aplicado · revise antes de salvar');
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label="Gerar rotina com IA"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-bg/95 flex items-start justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-surface border border-app-strong rounded-[16px] p-4 my-4">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold">✨ Gerar rotina com IA</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="ai-draft-close"
            className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        {state.kind === 'prompt' && (
          <PromptForm
            prompt={prompt}
            onPromptChange={setPrompt}
            alunoId={alunoId}
            onSubmit={gerar}
          />
        )}

        {state.kind === 'loading' && (
          <div data-testid="ai-draft-loading" className="text-center py-10">
            <div className="text-[28px] mb-2 animate-pulse" aria-hidden>🤖</div>
            <p className="text-[12px] text-ink-muted">
              Consultando IA… isso pode levar alguns segundos.
            </p>
          </div>
        )}

        {state.kind === 'preview' && (
          <Preview
            data={state.data}
            onApply={aplicar}
            onCancel={() => setState({ kind: 'prompt' })}
          />
        )}

        {state.kind === 'error' && (
          <div data-testid="ai-draft-error" className="text-center py-6">
            <p className="text-[12px] text-danger mb-3">{state.message}</p>
            <button
              type="button"
              onClick={gerar}
              className="text-mono text-[11px] uppercase tracking-wider text-accent font-bold"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptForm({
  prompt, onPromptChange, alunoId, onSubmit,
}: {
  prompt: string;
  onPromptChange: (s: string) => void;
  alunoId?: string;
  onSubmit: () => void;
}) {
  const tooShort = prompt.trim().length < MIN_PROMPT;
  return (
    <div>
      <p className="text-[12px] text-ink-muted mb-3">
        Descreva o objetivo, foco e nível do aluno. A IA monta o esqueleto;
        você revisa, ajusta e salva.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value.slice(0, MAX_PROMPT))}
        placeholder="Ciclo ABCD de hipertrofia focado em peito e ombros, aluno intermediário, 40min por sessão"
        rows={4}
        maxLength={MAX_PROMPT}
        data-testid="ai-draft-prompt"
        className="w-full px-3 py-2 rounded-[10px] bg-surface border border-app-strong text-ink text-[13px] resize-y mb-1"
      />
      <div className="text-right text-[10px] text-ink-subtle text-mono mb-3">
        {prompt.length}/{MAX_PROMPT}
      </div>
      {alunoId && (
        <div className="text-mono text-[10px] uppercase tracking-wider text-accent font-bold mb-3">
          ✓ Contexto do aluno selecionado entra no prompt (histórico de RPs)
        </div>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={tooShort}
        data-testid="ai-draft-generate"
        className={cn(
          'w-full h-11 rounded-[12px] bg-accent text-accent-ink',
          'text-[12px] font-bold uppercase tracking-wider',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        Gerar rotina
      </button>
    </div>
  );
}

function Preview({
  data, onApply, onCancel,
}: {
  data: DraftTreinoResponse;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { titulo, objetivoResumo, diasSugeridos, meta } = data;

  return (
    <div data-testid="ai-draft-preview">
      <div className="mb-3">
        <h3 className="text-[14px] font-bold mb-0.5" data-testid="ai-draft-titulo">{titulo}</h3>
        <p className="text-[11.5px] text-ink-muted leading-snug">{objetivoResumo}</p>
      </div>

      <div className="flex gap-1.5 mb-3" data-testid="ai-draft-meta">
        <MetaBadge color="accent" label={`${meta.matchesVerde} verde`} />
        <MetaBadge color="warn" label={`${meta.matchesLaranja} verificar`} />
        <MetaBadge color="danger" label={`${meta.matchesVermelho} manual`} />
      </div>

      <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
        {diasSugeridos.map((dia, di) => (
          <div key={di} data-testid={`ai-draft-dia-${di}`}>
            <div className="flex items-baseline justify-between mb-1.5">
              <div className="text-[12px] font-bold">{dia.label}</div>
              <div className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle">
                {dia.foco}
              </div>
            </div>
            <div className="space-y-1.5">
              {dia.exercicios.map((ex: DraftExercicio, ei) => (
                <AIDraftExercicioPreview
                  key={`${di}-${ei}`}
                  exercicio={ex}
                  index={di * 100 + ei}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          data-testid="ai-draft-back"
          className="flex-1 h-11 rounded-[12px] bg-surface border border-app text-ink-muted text-[12px] font-bold uppercase tracking-wider"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onApply}
          data-testid="ai-draft-apply"
          className="flex-1 h-11 rounded-[12px] bg-accent text-accent-ink text-[12px] font-bold uppercase tracking-wider"
        >
          Aplicar à prescrição
        </button>
      </div>
    </div>
  );
}

function MetaBadge({ color, label }: { color: 'accent' | 'warn' | 'danger'; label: string }) {
  const map = {
    accent: 'bg-accent/15 text-accent border-accent/30',
    warn: 'bg-warn-bg text-warn border-warn/30',
    danger: 'bg-danger-bg text-danger border-danger/30',
  };
  return (
    <span className={cn(
      'text-mono text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border',
      map[color],
    )}>
      {label}
    </span>
  );
}

export default AIDraftModal;
