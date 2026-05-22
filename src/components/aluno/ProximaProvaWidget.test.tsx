import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProximaProvaWidget, faseMacrociclo } from './ProximaProvaWidget';
import type { Prova } from '@/types/treino';

// PR #21 — testes originais de UI/buckets.
// PR #38 (Sprint 14) — estendidos pra cobrir 5 fases progressivas do
// macro-ciclo (base/peak/taper/race-week/race-day/post) + alvoTempo +
// local exibidos quando presentes.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/provas', () => ({ criarProva: vi.fn() }));

// Anotar como Prova — sem isso, `alvoTempo: null` e `local: null` inferiam
// tipo literal `null` (não `string | null`), e o `Partial<typeof PROVA_BASE>`
// rejeitava strings passadas via `extras`. tsc no build prod pegou; vitest
// local não. Fix do build do Vercel.
const PROVA_BASE: Prova = {
  id: 'p-1',
  alunoId: 'a-1',
  modalidade: 'CORRIDA',
  nome: 'Meia de Floripa',
  detalhes: {},
  prioridade: 'A',
  arquivada: false,
  alvoTempo: null,
  local: null,
  data: new Date().toISOString(),
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
};

function provaDaqui(dias: number, extras: Partial<Prova> = {}): Prova {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return { ...PROVA_BASE, ...extras, data: d.toISOString() };
}

describe('faseMacrociclo — função pura', () => {
  it('post (dias < 0)', () => {
    expect(faseMacrociclo(-1)).toBe('post');
    expect(faseMacrociclo(-30)).toBe('post');
  });
  it('race-day (dias === 0)', () => {
    expect(faseMacrociclo(0)).toBe('race-day');
  });
  it('race-week (1–7d)', () => {
    expect(faseMacrociclo(1)).toBe('race-week');
    expect(faseMacrociclo(7)).toBe('race-week');
  });
  it('taper (8–14d)', () => {
    expect(faseMacrociclo(8)).toBe('taper');
    expect(faseMacrociclo(14)).toBe('taper');
  });
  it('peak (15–30d)', () => {
    expect(faseMacrociclo(15)).toBe('peak');
    expect(faseMacrociclo(30)).toBe('peak');
  });
  it('base (>30d)', () => {
    expect(faseMacrociclo(31)).toBe('base');
    expect(faseMacrociclo(180)).toBe('base');
  });
});

describe('ProximaProvaWidget — countdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem prova → CTA "Defina sua Race A"', () => {
    render(<ProximaProvaWidget prova={null} onCriada={() => {}} />);
    expect(screen.getByTestId('prova-alvo-cta-vazio')).toBeInTheDocument();
    expect(screen.getByText(/Sem alvo definido/i)).toBeInTheDocument();
    expect(screen.getByText(/Race A/i)).toBeInTheDocument();
  });

  it('prova a 95 dias (base) → semanas restantes, sem badge', () => {
    render(<ProximaProvaWidget prova={provaDaqui(95)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'base');
    expect(screen.queryByTestId('prova-alvo-badge')).not.toBeInTheDocument();
    expect(screen.getByText(/semanas restantes/i)).toBeInTheDocument();
  });

  it('prova a 20 dias (peak) → fase=peak, ainda sem badge', () => {
    render(<ProximaProvaWidget prova={provaDaqui(20)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'peak');
    expect(screen.queryByTestId('prova-alvo-badge')).not.toBeInTheDocument();
  });

  it('prova a 12 dias (taper) → badge TAPER + dias', () => {
    render(<ProximaProvaWidget prova={provaDaqui(12)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'taper');
    expect(screen.getByTestId('prova-alvo-badge')).toHaveTextContent(/TAPER/i);
    expect(screen.getByText(/dias restantes/i)).toBeInTheDocument();
  });

  it('prova a 5 dias (race-week) → badge RACE WEEK pulsante', () => {
    render(<ProximaProvaWidget prova={provaDaqui(5)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'race-week');
    const badge = screen.getByTestId('prova-alvo-badge');
    expect(badge).toHaveTextContent(/RACE WEEK/i);
    expect(badge.className).toMatch(/animate-pulse/);
  });

  it('prova hoje (0d) → fase=race-day + badge "É HOJE" + 🏆', () => {
    render(<ProximaProvaWidget prova={provaDaqui(0)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'race-day');
    expect(screen.getByTestId('prova-alvo-badge')).toHaveTextContent(/É HOJE/i);
    // "é hoje" aparece no badge ("É HOJE") E no display ("é hoje") — getAllByText
    expect(screen.getAllByText(/é hoje/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/🏆/)).toBeInTheDocument();
  });

  it('prova passada → fase=post + badge CONCLUÍDA + "passou"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(-2)} onCriada={() => {}} />);
    const card = screen.getByTestId('prova-alvo-countdown');
    expect(card).toHaveAttribute('data-fase', 'post');
    expect(screen.getByTestId('prova-alvo-badge')).toHaveTextContent(/CONCLUÍDA/i);
    expect(screen.getByText(/passou/i)).toBeInTheDocument();
  });

  it('exibe local quando presente', () => {
    render(
      <ProximaProvaWidget
        prova={provaDaqui(95, { local: 'Florianópolis, SC' })}
        onCriada={() => {}}
      />,
    );
    expect(screen.getByText(/Florianópolis, SC/)).toBeInTheDocument();
  });

  it('exibe alvoTempo quando presente (fora de race-day/post)', () => {
    render(
      <ProximaProvaWidget
        prova={provaDaqui(95, { alvoTempo: '1:45:00' })}
        onCriada={() => {}}
      />,
    );
    expect(screen.getByText(/alvo 1:45:00/i)).toBeInTheDocument();
  });

  it('NÃO exibe alvoTempo em race-day', () => {
    render(
      <ProximaProvaWidget
        prova={provaDaqui(0, { alvoTempo: '1:45:00' })}
        onCriada={() => {}}
      />,
    );
    expect(screen.queryByText(/alvo 1:45:00/i)).not.toBeInTheDocument();
  });

  it('prova daqui a 1 dia → singular "dia restante"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(1)} onCriada={() => {}} />);
    expect(screen.getByText(/^1$/)).toBeInTheDocument();
    expect(screen.getByText(/^dia restante$/i)).toBeInTheDocument();
  });

  it('mostra modalidade humanizada no label', () => {
    render(<ProximaProvaWidget prova={provaDaqui(10)} onCriada={() => {}} />);
    expect(screen.getByText(/corrida.*alvo/i)).toBeInTheDocument();
  });

  it('formata data curta (dia/mês)', () => {
    const prova = provaDaqui(10);
    const d = new Date(prova.data);
    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const esperado = `${d.getDate()}/${meses[d.getMonth()]}`;
    render(<ProximaProvaWidget prova={prova} onCriada={() => {}} />);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });
});
