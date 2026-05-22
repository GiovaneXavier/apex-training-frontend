import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatDuracao, JiuJitsuLive, parseDuracao } from './JiuJitsuLive';
import type { Treino } from '@/types/treino';

// PR #23 — testa o counter +/-, slider readiness e submit offline-first.

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

const TREINO_BASE: Treino = {
  id: 't-1',
  alunoId: 'a-1',
  professorId: null,
  modalidade: 'JIU_JITSU',
  titulo: 'Aula de quinta',
  dataAlvo: new Date().toISOString(),
  status: 'PENDENTE',
  detalhes: {
    tipo: 'jiu_jitsu',
    rolas: { rounds: 5, tempoRoundSeg: 300 },
  },
  iniciadoEm: null,
  finalizadoEm: null,
  stravaActivityId: null,
  stravaAutoMatchAck: true,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
};

function renderLive(treino: Treino = TREINO_BASE) {
  return render(
    <MemoryRouter>
      <JiuJitsuLive treino={treino} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  salvarMock.mockReset();
  navigateMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('JiuJitsuLive — UI fricção-zero (PR #23)', () => {
  it('renderiza título do treino + resumo da prescrição', () => {
    renderLive();
    expect(screen.getByText('Aula de quinta')).toBeInTheDocument();
    expect(screen.getByText(/5 rounds × 5 min/i)).toBeInTheDocument();
  });

  it('pré-preenche rounds da prescrição (5)', () => {
    renderLive();
    expect(screen.getByTestId('rounds')).toHaveTextContent('5');
  });

  it('pré-preenche matTime sugerido (5×300=1500s → 25:00)', () => {
    renderLive();
    const input = screen.getByPlaceholderText(/45:00/i) as HTMLInputElement;
    expect(input.value).toBe('25:00');
  });

  it('readiness default = 7 + label dinâmico', () => {
    renderLive();
    expect(screen.getByText(/7\/10 · Bem disposto/i)).toBeInTheDocument();
  });

  it('counter +/- atualiza valores (rounds)', async () => {
    renderLive();
    const inc = screen.getAllByLabelText('Aumentar')[0]; // rounds é o primeiro counter
    await userEvent.click(inc);
    expect(screen.getByTestId('rounds')).toHaveTextContent('6');
    const dec = screen.getAllByLabelText('Diminuir')[0];
    await userEvent.click(dec);
    await userEvent.click(dec);
    expect(screen.getByTestId('rounds')).toHaveTextContent('4');
  });

  it('counter NÃO desce abaixo de 0', async () => {
    // Treino sem prescrição → rounds inicia em 0
    renderLive({ ...TREINO_BASE, detalhes: { tipo: 'jiu_jitsu' } });
    const dec = screen.getAllByLabelText('Diminuir')[0];
    await userEvent.click(dec);
    await userEvent.click(dec);
    expect(screen.getByTestId('rounds')).toHaveTextContent('0');
  });

  it('contador de chars na observação', async () => {
    renderLive();
    const textarea = screen.getByPlaceholderText(/Joelho travou/i);
    await userEvent.type(textarea, 'Foco em guarda');
    expect(screen.getByText('14/500')).toBeInTheDocument();
  });

  it('submit envia payload BJJ no formato esperado', async () => {
    salvarMock.mockResolvedValueOnce({ kind: 'synced', response: {} });
    renderLive();

    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));

    expect(salvarMock).toHaveBeenCalledTimes(1);
    const [treinoId, payload] = salvarMock.mock.calls[0];
    expect(treinoId).toBe('t-1');
    expect(payload.status).toBe('CONCLUIDO');
    expect(payload.realizado).toMatchObject({
      matTimeSegundos: 1500, // 25min sugeridos
      roundsCompletos: 5,
      readinessRating: 7,
    });
  });

  it('matTime opcional: vazio NÃO bloqueia submit', async () => {
    salvarMock.mockResolvedValueOnce({ kind: 'synced', response: {} });
    renderLive({ ...TREINO_BASE, detalhes: { tipo: 'jiu_jitsu' } });

    // Sem prescrição → input matTime vazio
    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));

    expect(salvarMock).toHaveBeenCalledTimes(1);
    const [, payload] = salvarMock.mock.calls[0];
    expect(payload.realizado.matTimeSegundos).toBeUndefined();
    expect(payload.realizado.readinessRating).toBe(7);
  });

  it('matTime inválido bloqueia submit + exibe erro', async () => {
    renderLive();
    const input = screen.getByPlaceholderText(/45:00/i);
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));
    expect(screen.getByText(/Tempo de tatame inválido/i)).toBeInTheDocument();
    expect(salvarMock).not.toHaveBeenCalled();
  });

  it('payload omite zeros pra rounds e finalizações', async () => {
    salvarMock.mockResolvedValueOnce({ kind: 'synced', response: {} });
    // Treino vazio + atleta não toca nos botões → rounds=0, fin=0
    renderLive({ ...TREINO_BASE, detalhes: { tipo: 'jiu_jitsu' } });
    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));
    const [, payload] = salvarMock.mock.calls[0];
    expect(payload.realizado.roundsCompletos).toBeUndefined();
    expect(payload.realizado.finalizacoesFeitas).toBeUndefined();
    expect(payload.realizado.finalizacoesSofridas).toBeUndefined();
    expect(payload.realizado.readinessRating).toBe(7); // readiness SEMPRE viaja
  });

  it('queued (offline) → toast info + navega', async () => {
    salvarMock.mockResolvedValueOnce({ kind: 'queued', entry: { id: 'q1' } });
    renderLive();
    await userEvent.click(screen.getByRole('button', { name: /Registrar treino/i }));
    expect(navigateMock).toHaveBeenCalledWith('/aluno/dashboard?ok=1', { replace: true });
  });
});

describe('formatDuracao / parseDuracao — helpers', () => {
  it('formatDuracao < 1h → mm:ss', () => {
    expect(formatDuracao(1500)).toBe('25:00');
    expect(formatDuracao(125)).toBe('2:05');
  });
  it('formatDuracao >= 1h → h:mm:ss', () => {
    expect(formatDuracao(3725)).toBe('1:02:05');
  });
  it('parseDuracao mm:ss', () => {
    expect(parseDuracao('25:00')).toBe(1500);
    expect(parseDuracao('2:05')).toBe(125);
  });
  it('parseDuracao h:mm:ss', () => {
    expect(parseDuracao('1:30:00')).toBe(5400);
  });
  it('parseDuracao rejeita formato inválido', () => {
    expect(parseDuracao('abc')).toBe(null);
    expect(parseDuracao('25:99')).toBe(null); // seg>59
    expect(parseDuracao('1:99:00')).toBe(null); // min>59
  });
});
