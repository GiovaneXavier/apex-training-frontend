import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAllDrafts, saveDraft } from '@/lib/offline/voiceDrafts';

import { JiuJitsuLive } from './JiuJitsuLive';
import type { Treino } from '@/types/treino';

// PR #25 — banner de rascunho de voz no JiuJitsuLive.
// Mocka apenas o que toca rede; voiceDrafts roda real sobre idb-keyval
// (mockado por test/setup como Map em memória).

const salvarMock = vi.fn();
vi.mock('@/lib/api/execucao', () => ({
  salvarExecucaoOfflineFirst: (...args: unknown[]) => salvarMock(...args),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>();
  return { ...real, useNavigate: () => navigateMock };
});

const TREINO: Treino = {
  id: 't-voice-1',
  alunoId: 'a-1',
  professorId: null,
  modalidade: 'JIU_JITSU',
  titulo: 'Aula com rascunho',
  dataAlvo: new Date().toISOString(),
  status: 'PENDENTE',
  detalhes: { tipo: 'jiu_jitsu', rolas: { rounds: 5, tempoRoundSeg: 300 } },
  iniciadoEm: null,
  finalizadoEm: null,
  stravaActivityId: null,
  stravaAutoMatchAck: true,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
};

function renderLive(treino: Treino = TREINO) {
  return render(
    <MemoryRouter>
      <JiuJitsuLive treino={treino} />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  salvarMock.mockReset();
  navigateMock.mockReset();
  await clearAllDrafts();
});
afterEach(async () => {
  await clearAllDrafts();
  vi.restoreAllMocks();
});

describe('JiuJitsuLive — banner de rascunho de voz (PR #25)', () => {
  it('SEM draft → não renderiza banner, mostra CTA de voz', async () => {
    renderLive();
    expect(screen.queryByTestId('voice-draft-banner')).not.toBeInTheDocument();
    // CTA aparece após effect inicial resolver (getDraft devolve null).
    await waitFor(() => {
      expect(screen.getByTestId('voice-open')).toBeInTheDocument();
    });
  });

  it('COM draft → renderiza banner, esconde CTA de voz', async () => {
    await saveDraft('t-voice-1', {
      fields: { matTimeSegundos: 1800, roundsCompletos: 4, readinessRating: 8 },
      transcript: null,
      confidence: 0.95,
      needsReview: false,
      warnings: [],
      partial: false,
    });

    renderLive();

    const banner = await screen.findByTestId('voice-draft-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.queryByTestId('voice-open')).not.toBeInTheDocument();
  });

  it('Aplicar draft → hidrata form + limpa draft + banner some', async () => {
    await saveDraft('t-voice-1', {
      fields: { matTimeSegundos: 1800, roundsCompletos: 6, readinessRating: 8, observacao: 'Joelho ok' },
      transcript: null,
      confidence: 0.95,
      needsReview: false,
      warnings: [],
      partial: false,
    });

    renderLive();
    const apply = await screen.findByTestId('voice-draft-apply');
    await userEvent.click(apply);

    // Banner some
    await waitFor(() => {
      expect(screen.queryByTestId('voice-draft-banner')).not.toBeInTheDocument();
    });

    // Form hidratado: rounds=6, matTime=30:00, observação preenchida
    expect(screen.getByTestId('rounds')).toHaveTextContent('6');
    const matInput = screen.getByPlaceholderText(/45:00/i) as HTMLInputElement;
    expect(matInput.value).toBe('30:00');
    const obs = screen.getByPlaceholderText(/Joelho travou/i) as HTMLTextAreaElement;
    expect(obs.value).toBe('Joelho ok');

    // Submit envia campos aplicados, não os defaults.
    salvarMock.mockResolvedValueOnce({ kind: 'synced', response: {} });
    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));
    const [, payload] = salvarMock.mock.calls[0];
    expect(payload.realizado).toMatchObject({
      matTimeSegundos: 1800,
      roundsCompletos: 6,
      readinessRating: 8,
      observacao: 'Joelho ok',
    });
  });

  it('Descartar draft → limpa draft + banner some + form preserva defaults', async () => {
    await saveDraft('t-voice-1', {
      fields: { matTimeSegundos: 9999, roundsCompletos: 42 },
      transcript: null,
      confidence: 0.4,
      needsReview: true,
      warnings: [],
      partial: false,
    });

    renderLive();
    const discard = await screen.findByTestId('voice-draft-discard');
    await userEvent.click(discard);

    await waitFor(() => {
      expect(screen.queryByTestId('voice-draft-banner')).not.toBeInTheDocument();
    });
    // Defaults preservados (não hidratou com lixo de baixa confiança).
    // Prescrição diz 5 rounds × 300s → matTime sugerido 25:00, rounds 5.
    expect(screen.getByTestId('rounds')).toHaveTextContent('5');
    const matInput = screen.getByPlaceholderText(/45:00/i) as HTMLInputElement;
    expect(matInput.value).toBe('25:00');
  });
});
