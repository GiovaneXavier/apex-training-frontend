import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExerciseBlockAISuggest, __internal } from './ExerciseBlockAISuggest';

// PR #29 — testa estados + integração callback.

const postMock = vi.fn();

vi.mock('@/lib/api/aiProgression', () => ({
  postExerciseProgression: (args: unknown) => postMock(args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeResp(over: Partial<{ tipoProgressao: string; cargaEstimadaKg: number | null; sets: number; reps: string }> = {}) {
  return {
    sugestao: {
      sets: 4,
      reps: '8-10',
      cargaEstimadaKg: 82.5,
      rpeAlvo: 8,
      justificativa: 'RPE médio 7 estável; sobe 2.5kg pra novo estímulo.',
      tipoProgressao: 'intensidade',
      ...over,
    },
    contextoUsado: {
      execucoesConsideradas: 3,
      rpeMedioRecente: 7,
      houveFalhaDeReps: false,
      diasDesdeUltima: 5,
      modalidade: 'MUSCULACAO',
    },
  };
}

beforeEach(() => postMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('repsStringToNumber — parser de progressão', () => {
  it('faixa "8-10" → 10 (sobrecarga progressiva pela meta alta)', () => {
    expect(__internal.repsStringToNumber('8-10')).toBe(10);
  });
  it('faixa "12-15" → 15', () => {
    expect(__internal.repsStringToNumber('12-15')).toBe(15);
  });
  it('número solo "12" → 12', () => {
    expect(__internal.repsStringToNumber('12')).toBe(12);
  });
  it('iso "30s" → 30 (primeiro número)', () => {
    expect(__internal.repsStringToNumber('30s')).toBe(30);
  });
  it('AMRAP / Fadiga → fallback 12', () => {
    expect(__internal.repsStringToNumber('AMRAP')).toBe(12);
    expect(__internal.repsStringToNumber('Fadiga')).toBe(12);
  });
});

describe('ExerciseBlockAISuggest — estados (PR #29)', () => {
  it('idle: botão visível, habilitado quando alunoId + exercicio preenchidos', () => {
    render(
      <ExerciseBlockAISuggest
        alunoId="aluno-1"
        exercicioNome="Supino Reto"
        onApply={() => {}}
      />,
    );
    const btn = screen.getByTestId('ai-suggest-button');
    expect(btn).toBeEnabled();
  });

  it('idle: disabled SEM alunoId', () => {
    render(
      <ExerciseBlockAISuggest
        alunoId=""
        exercicioNome="Supino"
        onApply={() => {}}
      />,
    );
    expect(screen.getByTestId('ai-suggest-button')).toBeDisabled();
  });

  it('idle: disabled SEM exercicioNome', () => {
    render(
      <ExerciseBlockAISuggest
        alunoId="aluno-1"
        exercicioNome=""
        onApply={() => {}}
      />,
    );
    expect(screen.getByTestId('ai-suggest-button')).toBeDisabled();
  });

  it('loading: spinner enquanto IA responde', async () => {
    let resolve!: (v: unknown) => void;
    postMock.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(
      <ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={() => {}} />,
    );
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    expect(screen.getByTestId('ai-suggest-loading')).toBeInTheDocument();

    resolve(makeResp());
    await waitFor(() => {
      expect(screen.getByTestId('ai-suggest-popover')).toBeInTheDocument();
    });
  });

  it('suggestion: popover mostra tipoProgressao badge + sets + reps + carga + justificativa', async () => {
    postMock.mockResolvedValue(makeResp());
    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={() => {}} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));

    const tipo = await screen.findByTestId('ai-suggest-tipo');
    expect(tipo).toHaveAttribute('data-tipo', 'intensidade');
    expect(tipo).toHaveTextContent(/Intensidade/i);

    expect(screen.getByTestId('ai-suggest-justificativa')).toHaveTextContent(/RPE médio 7/);
    expect(screen.getByText(/82\.5kg/)).toBeInTheDocument();
  });

  it('badge muda cor/label conforme tipoProgressao=deload', async () => {
    postMock.mockResolvedValue(makeResp({ tipoProgressao: 'deload' }));
    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={() => {}} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    const tipo = await screen.findByTestId('ai-suggest-tipo');
    expect(tipo).toHaveAttribute('data-tipo', 'deload');
    expect(tipo).toHaveTextContent(/Deload/i);
  });

  it('calistenia (cargaEstimadaKg=null) → célula mostra RPE no lugar de kg', async () => {
    postMock.mockResolvedValue(makeResp({
      cargaEstimadaKg: null,
      // Justificativa de calistenia não menciona kg pra deixar a asserção limpa.
      // (Justificativa real de musculação pode citar kg; é texto livre do LLM.)
      reps: '10-12',
    }));
    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Barra" modalidade="CALISTENIA" onApply={() => {}} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    await screen.findByTestId('ai-suggest-popover');
    // Cell de carga/RPE: quando cargaEstimadaKg=null, mostra RPE. Verifica
    // que não há "Xkg" como número+kg na célula visível.
    expect(screen.queryByText(/^\d+(\.\d+)?kg$/)).not.toBeInTheDocument();
    expect(screen.getByText(/RPE 8/)).toBeInTheDocument();
  });

  it('error: render mensagem + botão retry; retry refaz fetch', async () => {
    postMock.mockRejectedValueOnce(new Error('Timeout IA'));
    postMock.mockResolvedValueOnce(makeResp());

    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={() => {}} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    const err = await screen.findByTestId('ai-suggest-error');
    expect(err).toBeInTheDocument();

    await userEvent.click(screen.getByText(/Retry/i));
    await waitFor(() => {
      expect(screen.getByTestId('ai-suggest-popover')).toBeInTheDocument();
    });
  });
});

describe('ExerciseBlockAISuggest — HITL callbacks', () => {
  it('Aplicar → chama onApply com series + reps parseado ("8-10" → 10) e volta pra idle', async () => {
    postMock.mockResolvedValue(makeResp());
    const onApply = vi.fn();
    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={onApply} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    await userEvent.click(await screen.findByTestId('ai-suggest-apply'));

    expect(onApply).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledWith({ series: 4, reps: 10 });
    // Volta pra idle (botão visível de novo)
    expect(screen.getByTestId('ai-suggest-button')).toBeInTheDocument();
  });

  it('Descartar → NÃO chama onApply, volta pra idle', async () => {
    postMock.mockResolvedValue(makeResp());
    const onApply = vi.fn();
    render(<ExerciseBlockAISuggest alunoId="a1" exercicioNome="Supino" onApply={onApply} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    await userEvent.click(await screen.findByTestId('ai-suggest-dismiss'));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('ai-suggest-button')).toBeInTheDocument();
  });

  it('Aplicar passa pra backend o alunoId e exercicioNome corretos', async () => {
    postMock.mockResolvedValue(makeResp());
    render(<ExerciseBlockAISuggest alunoId="aluno-abc" exercicioNome="Agachamento Livre" onApply={() => {}} />);
    await userEvent.click(screen.getByTestId('ai-suggest-button'));
    expect(postMock).toHaveBeenCalledWith({
      alunoId: 'aluno-abc',
      exercicioNome: 'Agachamento Livre',
      modalidade: 'MUSCULACAO',
    });
  });
});
