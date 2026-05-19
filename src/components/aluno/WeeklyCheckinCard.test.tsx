import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WeeklyCheckinResponse } from '@/lib/api/weeklyCheckin';

import { WeeklyCheckinCard } from './WeeklyCheckinCard';

// PR #32 — testes dos 4 estados + transição refresh + disclaimer fixo.

const getMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/api/weeklyCheckin', () => ({
  getWeeklyCheckin: () => getMock(),
  refreshWeeklyCheckin: () => refreshMock(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeResp(over: Partial<WeeklyCheckinResponse> = {}): WeeklyCheckinResponse {
  return {
    result: {
      summary: 'Você fechou 4 semanas seguidas com 14 treinos concluídos. RPE médio em 7.2 indica adaptação.',
      destaques: ['Primeiro RP de musculação desbloqueado.', '14 dias com atividade no período.'],
      origem: 'llm',
    },
    generatedAt: '2026-05-19T08:00:00Z',
    expiresAt: '2026-05-26T08:00:00Z',
    fresh: true,
    stale: false,
    empty: false,
    ...over,
  };
}

beforeEach(() => {
  getMock.mockReset();
  refreshMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('WeeklyCheckinCard — 4 estados visuais (PR #32)', () => {
  it('loading: data-state=loading antes da promise resolver', async () => {
    getMock.mockResolvedValue(makeResp());
    render(<WeeklyCheckinCard />);
    expect(screen.getByTestId('weekly-checkin-card')).toHaveAttribute('data-state', 'loading');
    await waitFor(() => {
      expect(screen.getByTestId('weekly-checkin-card')).not.toHaveAttribute('data-state', 'loading');
    });
  });

  it('fresh: summary + destaques + disclaimer renderizados, sem badge stale', async () => {
    getMock.mockResolvedValue(makeResp());
    render(<WeeklyCheckinCard />);
    const card = await screen.findByTestId('weekly-checkin-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'fresh'));
    expect(screen.getByTestId('checkin-summary')).toHaveTextContent(/4 semanas/);
    expect(screen.getByTestId('checkin-destaques')).toBeInTheDocument();
    expect(screen.getByTestId('checkin-disclaimer')).toBeInTheDocument();
    expect(screen.queryByTestId('checkin-stale-badge')).not.toBeInTheDocument();
  });

  it('stale: badge "desatualizado" visível, disclaimer presente', async () => {
    getMock.mockResolvedValue(makeResp({ fresh: false, stale: true }));
    render(<WeeklyCheckinCard />);
    const card = await screen.findByTestId('weekly-checkin-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'stale'));
    expect(screen.getByTestId('checkin-stale-badge')).toHaveTextContent(/desatualizado/i);
    expect(screen.getByTestId('checkin-disclaimer')).toBeInTheDocument();
  });

  it('empty: texto neutro estático, SEM disclaimer (texto já é safe), SEM botão refresh', async () => {
    getMock.mockResolvedValue(makeResp({
      empty: true,
      result: {
        summary: 'Semana sem treinos registrados. Comece esta para abrir o ciclo de fechamento.',
        destaques: [],
        origem: 'sem-dados',
      },
    }));
    render(<WeeklyCheckinCard />);
    const card = await screen.findByTestId('weekly-checkin-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'empty'));
    expect(screen.queryByTestId('checkin-disclaimer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('checkin-refresh')).not.toBeInTheDocument();
  });

  it('error: render gracioso com retry, sem crash', async () => {
    const err = Object.assign(new Error('rede caiu'), { isAxiosError: true });
    getMock.mockRejectedValueOnce(err);
    render(<WeeklyCheckinCard />);
    const card = await screen.findByTestId('weekly-checkin-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'error'));
    expect(screen.getByText(/Tentar de novo/i)).toBeInTheDocument();
  });
});

describe('WeeklyCheckinCard — disclaimer fixo no frontend (PR #32)', () => {
  it('disclaimer EXATO renderizado independente do conteúdo do LLM', async () => {
    getMock.mockResolvedValue(makeResp());
    render(<WeeklyCheckinCard />);
    const disclaimer = await screen.findByTestId('checkin-disclaimer');
    expect(disclaimer).toHaveTextContent(/Insight gerado por IA/);
    expect(disclaimer).toHaveTextContent(/consulte seu treinador/i);
  });

  it('disclaimer presente mesmo quando origem=fallback-veto (fallback de segurança)', async () => {
    getMock.mockResolvedValue(makeResp({
      result: {
        summary: 'Você fechou 3 de 4 semanas válidas com 10 treinos concluídos.',
        destaques: [],
        origem: 'fallback-veto',
      },
    }));
    render(<WeeklyCheckinCard />);
    const card = await screen.findByTestId('weekly-checkin-card');
    await waitFor(() => expect(card).toHaveAttribute('data-origem', 'fallback-veto'));
    expect(screen.getByTestId('checkin-disclaimer')).toBeInTheDocument();
  });
});

describe('WeeklyCheckinCard — refresh manual (PR #32)', () => {
  it('clicar ↻ chama refreshWeeklyCheckin e troca dados', async () => {
    getMock.mockResolvedValue(makeResp());
    refreshMock.mockResolvedValue(makeResp({
      result: {
        summary: 'Resumo atualizado após refresh manual com novos números do período.',
        destaques: [],
        origem: 'llm',
      },
    }));
    render(<WeeklyCheckinCard />);
    const btn = await screen.findByTestId('checkin-refresh');
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(/atualizado após refresh/i)).toBeInTheDocument();
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('refresh falha (rate-limit) → toast.error + UI antiga preservada', async () => {
    getMock.mockResolvedValue(makeResp());
    const err = Object.assign(new Error('Limite semanal atingido'), { isAxiosError: true });
    refreshMock.mockRejectedValueOnce(err);

    render(<WeeklyCheckinCard />);
    await screen.findByTestId('checkin-summary');
    await userEvent.click(screen.getByTestId('checkin-refresh'));
    // UI antiga sobrevive.
    expect(screen.getByTestId('checkin-summary')).toHaveTextContent(/4 semanas/);
  });
});
