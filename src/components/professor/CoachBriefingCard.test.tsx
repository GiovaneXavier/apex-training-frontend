import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CoachBriefingCard } from './CoachBriefingCard';

// PR #28 — testes dos 5 estados visuais + transição refresh.

const getMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('@/lib/api/coachBriefing', () => ({
  getCoachBriefing: () => getMock(),
  refreshCoachBriefing: () => refreshMock(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderCard() {
  return render(<MemoryRouter><CoachBriefingCard /></MemoryRouter>);
}

function makeResp(over: Partial<Parameters<typeof renderCard> extends never ? never : object> = {}) {
  return {
    result: {
      summary: 'Atenção pros 2 alunos abaixo. Restante segue no rumo.',
      alunosEmAlerta: [
        { alunoId: 'a1', prioridade: 'alta', sinal: 'Sumiu há 9 dias', sugestaoAcao: 'Mande mensagem hoje' },
        { alunoId: 'a2', prioridade: 'media', sinal: 'Perdeu 2 sessões', sugestaoAcao: 'Ajustar quarta' },
      ],
      alunosBemEncaminhados: [
        { alunoId: 'a3', motivo: 'Volume estável e RP novo semana passada' },
      ],
    },
    generatedAt: '2026-05-18T10:00:00Z',
    expiresAt: '2026-05-19T10:00:00Z',
    fresh: true,
    stale: false,
    empty: false,
    alunosVinculadosTotal: 12,
    alunosResiduais: 0,
    ...over,
  };
}

beforeEach(() => {
  getMock.mockReset();
  refreshMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('CoachBriefingCard — estados visuais (PR #28)', () => {
  it('estado: loading → render skeleton (data-state=loading)', () => {
    // Resolve nunca
    getMock.mockImplementation(() => new Promise(() => {}));
    renderCard();
    const card = screen.getByTestId('coach-briefing-card');
    expect(card).toHaveAttribute('data-state', 'loading');
  });

  it('estado: fresh → summary + alunos em alerta + bem encaminhados', async () => {
    getMock.mockResolvedValue(makeResp());
    renderCard();
    const card = await screen.findByTestId('coach-briefing-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'fresh'));
    expect(screen.getByText(/Atenção pros 2 alunos/i)).toBeInTheDocument();
    expect(screen.getByTestId('alerta-a1')).toBeInTheDocument();
    expect(screen.getByTestId('alerta-a2')).toBeInTheDocument();
    expect(screen.getByTestId('bom-a3')).toBeInTheDocument();
    expect(screen.queryByTestId('stale-badge')).not.toBeInTheDocument();
  });

  it('estado: stale → badge "desatualizado" visível', async () => {
    getMock.mockResolvedValue(makeResp({ fresh: false, stale: true }));
    renderCard();
    const badge = await screen.findByTestId('stale-badge');
    expect(badge).toHaveTextContent(/desatualizado/i);
    const card = screen.getByTestId('coach-briefing-card');
    expect(card).toHaveAttribute('data-state', 'stale');
  });

  it('estado: empty → mensagem amigável, sem alertas/bem encaminhados', async () => {
    getMock.mockResolvedValue(makeResp({
      empty: true,
      result: {
        summary: 'Você ainda não tem alunos vinculados. Convide pela aba de alunos.',
        alunosEmAlerta: [],
        alunosBemEncaminhados: [],
      },
    }));
    renderCard();
    const card = await screen.findByTestId('coach-briefing-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'empty'));
    expect(screen.getByText(/não tem alunos vinculados/i)).toBeInTheDocument();
  });

  it('estado: error → mensagem + CTA retry', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    renderCard();
    const card = await screen.findByTestId('coach-briefing-card');
    await waitFor(() => expect(card).toHaveAttribute('data-state', 'error'));
    expect(screen.getByText(/Tentar de novo/i)).toBeInTheDocument();
  });

  it('exibe contador de alunos residuais quando há excedente', async () => {
    getMock.mockResolvedValue(makeResp({ alunosResiduais: 17 }));
    renderCard();
    expect(await screen.findByText(/\+ 17 alunos fora deste resumo/i)).toBeInTheDocument();
  });
});

describe('CoachBriefingCard — refresh manual (PR #28)', () => {
  it('clicar ↻ chama refreshCoachBriefing e troca dados', async () => {
    getMock.mockResolvedValue(makeResp());
    refreshMock.mockResolvedValue(makeResp({
      result: {
        summary: 'Resumo atualizado manualmente após refresh.',
        alunosEmAlerta: [],
        alunosBemEncaminhados: [],
      },
    }));
    renderCard();
    const btn = await screen.findByTestId('briefing-refresh');
    await userEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(/atualizado manualmente/i)).toBeInTheDocument();
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it('refresh falha → toast.error, mantém UI antiga', async () => {
    getMock.mockResolvedValue(makeResp());
    refreshMock.mockRejectedValue(new Error('rate-limit'));
    renderCard();
    await screen.findByText(/Atenção pros 2 alunos/i);
    await userEvent.click(screen.getByTestId('briefing-refresh'));
    // UI mantém summary antigo (refresh falhou).
    expect(screen.getByText(/Atenção pros 2 alunos/i)).toBeInTheDocument();
  });
});
