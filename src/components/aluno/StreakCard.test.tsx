import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StreakCard } from './StreakCard';

const getStreakMock = vi.fn();

vi.mock('@/lib/api/conquistas', () => ({
  getStreak: () => getStreakMock(),
}));

function renderCard() {
  return render(<MemoryRouter><StreakCard /></MemoryRouter>);
}

function makeStreak(over: Partial<{ atual: number; maximoHistorico: number; semanas: number[] }> = {}) {
  const atual = over.atual ?? 4;
  const maximoHistorico = over.maximoHistorico ?? atual;
  // semanas: array de N de atividades. Default 12 semanas com mix.
  const semanas = over.semanas ?? [0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3];
  return {
    atual,
    maximoHistorico,
    semanasUltimas12: semanas.map((atividades, i) => ({
      semana: `2026-04-${String(6 + i * 7).padStart(2, '0')}`,
      atividades,
      valida: atividades >= 3,
    })),
  };
}

beforeEach(() => getStreakMock.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('StreakCard — estados visuais (PR #31)', () => {
  it('loading: data-state=loading no primeiro render (antes do useEffect resolver)', async () => {
    // mockResolvedValue: promise resolve imediatamente, mas o useEffect só
    // dispara depois do render inicial → check síncrono pega o loading.
    getStreakMock.mockResolvedValue(makeStreak({ atual: 0 }));
    renderCard();
    expect(screen.getByTestId('streak-card')).toHaveAttribute('data-state', 'loading');
    // Aguarda transição pra estado real (cleanup gracioso entre testes).
    await waitFor(() => {
      expect(screen.getByTestId('streak-card')).not.toHaveAttribute('data-state', 'loading');
    });
  });

  it('atual=0 → estado "rest" 💤 com mensagem encorajadora (sem shame)', async () => {
    getStreakMock.mockResolvedValue(makeStreak({ atual: 0, maximoHistorico: 0, semanas: Array(12).fill(0) }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-card')).toHaveAttribute('data-state', 'rest');
    });
    expect(screen.getByTestId('streak-atual')).toHaveTextContent('0');
    expect(screen.getByText(/3 treinos esta semana/i)).toBeInTheDocument();
  });

  it('atual=2 → estado "sprout" 🌱', async () => {
    getStreakMock.mockResolvedValue(makeStreak({ atual: 2 }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-card')).toHaveAttribute('data-state', 'sprout');
    });
    expect(screen.getByText(/construindo o hábito/i)).toBeInTheDocument();
  });

  it('atual=4 → estado "fire" 🔥', async () => {
    getStreakMock.mockResolvedValue(makeStreak({ atual: 4 }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-card')).toHaveAttribute('data-state', 'fire');
    });
    expect(screen.getByText(/4 semanas consecutivas/i)).toBeInTheDocument();
  });

  it('recorde > atual → exibe badge "recorde X"', async () => {
    getStreakMock.mockResolvedValue(makeStreak({ atual: 2, maximoHistorico: 8 }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-recorde')).toHaveTextContent(/recorde 8/);
    });
  });

  it('recorde == atual → NÃO exibe badge', async () => {
    getStreakMock.mockResolvedValue(makeStreak({ atual: 4, maximoHistorico: 4 }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-atual')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('streak-recorde')).not.toBeInTheDocument();
  });

  it('dot row renderiza exatamente 12 semanas com data-valida correta', async () => {
    const semanas = [0, 0, 3, 3, 3, 3, 0, 3, 3, 3, 3, 3];
    getStreakMock.mockResolvedValue(makeStreak({ atual: 5, semanas }));
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-dotrow')).toBeInTheDocument();
    });
    for (let i = 0; i < 12; i++) {
      const dot = screen.getByTestId(`streak-dot-${i}`);
      expect(dot).toHaveAttribute('data-valida', String(semanas[i] >= 3));
    }
  });

  it('error: render gracioso sem crash', async () => {
    // mockRejectedValueOnce com axios-like error (mesmo padrão dos demais
    // testes do projeto, ex: execucao.test.ts). Vitest reconhece como
    // rejeição roteada via thenable, não unhandled prematuro.
    const err = Object.assign(new Error('rede caiu'), { isAxiosError: true });
    getStreakMock.mockRejectedValueOnce(err);
    renderCard();
    await waitFor(() => {
      expect(screen.getByTestId('streak-card')).toHaveAttribute('data-state', 'error');
    });
  });
});
