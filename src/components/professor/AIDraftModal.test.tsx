import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DraftTreinoResponse } from '@/lib/api/aiDraft';

import { AIDraftModal } from './AIDraftModal';

// PR #30 — modal de geração IA. 4 estados + callbacks.

const postMock = vi.fn();

vi.mock('@/lib/api/aiDraft', () => ({
  postDraftTreino: (args: unknown) => postMock(args),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function makeDraft(over: Partial<DraftTreinoResponse> = {}): DraftTreinoResponse {
  return {
    titulo: 'ABCD Hipertrofia',
    objetivoResumo: 'Ciclo de 4 dias focado em peito e ombros.',
    diasSugeridos: [
      {
        label: 'Dia A — Peito/Tríceps',
        foco: 'Peito',
        exercicios: [
          {
            nome: 'Supino Reto',
            series: 4, repsRange: '8-12', cargaPctRP: null, descansoSeg: 90,
            exercicioId: 'ex-1', nomeCanonico: 'Supino Reto',
            similarityScore: 0.98, confianca: 'verde',
          },
          {
            nome: 'Crucifixo Inclinado',
            series: 3, repsRange: '10-12', cargaPctRP: null, descansoSeg: 60,
            exercicioId: 'ex-2', nomeCanonico: 'Crucifixo Inclinado Halter',
            similarityScore: 0.72, confianca: 'laranja',
          },
        ],
      },
      {
        label: 'Dia B — Costas',
        foco: 'Costas',
        exercicios: [
          {
            nome: 'Movimento Fantasma',
            series: 3, repsRange: '8-10', cargaPctRP: null, descansoSeg: 90,
            exercicioId: null, nomeCanonico: null,
            similarityScore: 0.2, confianca: 'vermelho',
          },
        ],
      },
    ],
    meta: {
      modelo: 'claude-haiku',
      exerciciosUnicos: 3,
      matchesVerde: 1, matchesLaranja: 1, matchesVermelho: 1,
    },
    ...over,
  };
}

beforeEach(() => postMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('AIDraftModal — estado prompt', () => {
  it('renderiza textarea + botão gerar (disabled enquanto curto)', () => {
    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    const textarea = screen.getByTestId('ai-draft-prompt');
    expect(textarea).toBeInTheDocument();
    expect(screen.getByTestId('ai-draft-generate')).toBeDisabled();
  });

  it('digitar prompt habilita botão gerar', async () => {
    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD hipertrofia');
    expect(screen.getByTestId('ai-draft-generate')).toBeEnabled();
  });

  it('com alunoId selecionado → hint de contexto aparece', () => {
    render(<AIDraftModal alunoId="aluno-1" onApply={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/Contexto do aluno selecionado/i)).toBeInTheDocument();
  });

  it('SEM alunoId → hint de contexto NÃO aparece', () => {
    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    expect(screen.queryByText(/Contexto do aluno/i)).not.toBeInTheDocument();
  });
});

describe('AIDraftModal — fluxo completo', () => {
  it('clicar Gerar → loading → preview', async () => {
    let resolve!: (v: unknown) => void;
    postMock.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD hipertrofia');
    await userEvent.click(screen.getByTestId('ai-draft-generate'));
    expect(screen.getByTestId('ai-draft-loading')).toBeInTheDocument();

    resolve(makeDraft());
    await waitFor(() => {
      expect(screen.getByTestId('ai-draft-preview')).toBeInTheDocument();
    });
  });

  it('preview mostra titulo, meta badges, e exercícios por dia', async () => {
    postMock.mockResolvedValue(makeDraft());
    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD hipertrofia');
    await userEvent.click(screen.getByTestId('ai-draft-generate'));

    await screen.findByTestId('ai-draft-preview');
    expect(screen.getByTestId('ai-draft-titulo')).toHaveTextContent('ABCD Hipertrofia');
    expect(screen.getByText(/1 verde/i)).toBeInTheDocument();
    expect(screen.getByText(/1 verificar/i)).toBeInTheDocument();
    expect(screen.getByText(/1 manual/i)).toBeInTheDocument();
    expect(screen.getByTestId('ai-draft-dia-0')).toBeInTheDocument();
    expect(screen.getByTestId('ai-draft-dia-1')).toBeInTheDocument();
  });

  it('clicar Aplicar → onApply recebe draft completo + onClose chamado', async () => {
    postMock.mockResolvedValue(makeDraft());
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<AIDraftModal onApply={onApply} onClose={onClose} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD');
    await userEvent.click(screen.getByTestId('ai-draft-generate'));
    await userEvent.click(await screen.findByTestId('ai-draft-apply'));

    expect(onApply).toHaveBeenCalledOnce();
    const arg = onApply.mock.calls[0][0];
    expect(arg.titulo).toBe('ABCD Hipertrofia');
    expect(arg.diasSugeridos).toHaveLength(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clicar Voltar volta pra estado prompt sem chamar onApply', async () => {
    postMock.mockResolvedValue(makeDraft());
    const onApply = vi.fn();
    render(<AIDraftModal onApply={onApply} onClose={() => {}} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD');
    await userEvent.click(screen.getByTestId('ai-draft-generate'));
    await userEvent.click(await screen.findByTestId('ai-draft-back'));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('ai-draft-prompt')).toBeInTheDocument();
  });

  it('falha de rede → estado error + retry funciona', async () => {
    postMock.mockRejectedValueOnce(new Error('Timeout IA'));
    postMock.mockResolvedValueOnce(makeDraft());
    render(<AIDraftModal onApply={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByTestId('ai-draft-prompt'), 'ABCD');
    await userEvent.click(screen.getByTestId('ai-draft-generate'));

    await screen.findByTestId('ai-draft-error');
    await userEvent.click(screen.getByText(/Tentar de novo/i));
    await waitFor(() => {
      expect(screen.getByTestId('ai-draft-preview')).toBeInTheDocument();
    });
  });

  it('botão ✕ fecha modal direto via onClose', async () => {
    const onClose = vi.fn();
    render(<AIDraftModal onApply={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByTestId('ai-draft-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
