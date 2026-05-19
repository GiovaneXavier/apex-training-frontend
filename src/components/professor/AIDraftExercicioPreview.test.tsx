import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { DraftExercicio } from '@/lib/api/aiDraft';

import { AIDraftExercicioPreview } from './AIDraftExercicioPreview';

// PR #30 — preview por exercício, 3 estados de confiança.

function makeEx(over: Partial<DraftExercicio> = {}): DraftExercicio {
  return {
    nome: 'Supino Inclinado com Halteres',
    series: 4,
    repsRange: '8-12',
    cargaPctRP: null,
    descansoSeg: 90,
    exercicioId: 'ex-1',
    nomeCanonico: 'Supino Inclinado com Halteres',
    similarityScore: 0.95,
    confianca: 'verde',
    ...over,
  };
}

describe('AIDraftExercicioPreview — semáforo (PR #30)', () => {
  it('verde: dot verde + nome canônico direto, sem subtítulo de divergência', () => {
    render(<AIDraftExercicioPreview exercicio={makeEx()} index={0} />);
    const node = screen.getByTestId('ai-draft-exercicio-0');
    expect(node).toHaveAttribute('data-confianca', 'verde');
    expect(screen.getByTestId('ai-draft-nome-0')).toHaveTextContent(/Supino Inclinado/);
    expect(screen.queryByText(/IA:/)).not.toBeInTheDocument();
  });

  it('laranja: mostra "IA: X" como subtítulo quando nomeCanonico difere do LLM', () => {
    render(
      <AIDraftExercicioPreview
        exercicio={makeEx({
          nome: 'Supino Inclinado Haltere',
          nomeCanonico: 'Supino Inclinado com Halteres',
          similarityScore: 0.75,
          confianca: 'laranja',
        })}
        index={0}
      />,
    );
    const node = screen.getByTestId('ai-draft-exercicio-0');
    expect(node).toHaveAttribute('data-confianca', 'laranja');
    // Nome principal: canônico
    expect(screen.getByTestId('ai-draft-nome-0')).toHaveTextContent('Supino Inclinado com Halteres');
    // Subtítulo: nome do LLM + score
    expect(screen.getByText(/IA: "Supino Inclinado Haltere"/)).toBeInTheDocument();
    expect(screen.getByText(/sim 75%/)).toBeInTheDocument();
  });

  it('laranja sem divergência (nomes iguais) → NÃO mostra subtítulo', () => {
    render(
      <AIDraftExercicioPreview
        exercicio={makeEx({
          nome: 'Supino Reto',
          nomeCanonico: 'Supino Reto',
          similarityScore: 0.72,
          confianca: 'laranja',
        })}
        index={0}
      />,
    );
    expect(screen.queryByText(/IA:/)).not.toBeInTheDocument();
  });

  it('vermelho: mostra nome do LLM + aviso "Sem match", dot vermelho', () => {
    render(
      <AIDraftExercicioPreview
        exercicio={makeEx({
          nome: 'Movimento Exótico do Tio Beto',
          exercicioId: null,
          nomeCanonico: null,
          similarityScore: 0.2,
          confianca: 'vermelho',
        })}
        index={0}
      />,
    );
    const node = screen.getByTestId('ai-draft-exercicio-0');
    expect(node).toHaveAttribute('data-confianca', 'vermelho');
    expect(screen.getByTestId('ai-draft-nome-0')).toHaveTextContent('Movimento Exótico');
    expect(screen.getByText(/Sem match no catálogo/i)).toBeInTheDocument();
  });

  it('exibe series×reps e descanso, omite cargaPctRP quando null', () => {
    render(
      <AIDraftExercicioPreview
        exercicio={makeEx({ series: 4, repsRange: '8-12', cargaPctRP: null, descansoSeg: 90 })}
        index={0}
      />,
    );
    expect(screen.getByText(/4×8-12.*90s descanso/)).toBeInTheDocument();
    expect(screen.queryByText(/% RP/)).not.toBeInTheDocument();
  });

  it('exibe cargaPctRP quando preenchido', () => {
    render(
      <AIDraftExercicioPreview
        exercicio={makeEx({ cargaPctRP: 75 })}
        index={0}
      />,
    );
    expect(screen.getByText(/75% RP/)).toBeInTheDocument();
  });
});
