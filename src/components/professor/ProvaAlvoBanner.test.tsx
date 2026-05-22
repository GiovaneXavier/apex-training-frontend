import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProvaAlvoBanner } from './ProvaAlvoBanner';

// PR #39 (Sprint 14) — testes do banner de contexto Race A na tela de
// prescrição do professor.
//
// Foco:
//   - render condicional por estado (loading/sem-alvo/ready/idle).
//   - simetria visual com o widget herói: 5 fases reconhecidas.
//   - hook onFaseChange dispara nos momentos certos (PR futuro IA Coach).
//   - alunoId vazio → não renderiza (null), não dispara fetch.

vi.mock('@/lib/api/provas', () => ({ getProvaAlvo: vi.fn() }));

import { getProvaAlvo } from '@/lib/api/provas';

const getProvaAlvoMock = getProvaAlvo as unknown as ReturnType<typeof vi.fn>;

function provaDaqui(dias: number, extras: Record<string, unknown> = {}) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return {
    id: 'p-1',
    alunoId: 'a-1',
    modalidade: 'CORRIDA' as const,
    nome: 'Maratona Floripa',
    data: d.toISOString(),
    prioridade: 'A' as const,
    arquivada: false,
    alvoTempo: null,
    local: null,
    detalhes: {},
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    ...extras,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProvaAlvoBanner — gating', () => {
  it('alunoId vazio → não renderiza nada (null) e não chama API', () => {
    const { container } = render(<ProvaAlvoBanner alunoId="" />);
    expect(container).toBeEmptyDOMElement();
    expect(getProvaAlvoMock).not.toHaveBeenCalled();
  });

  it('aluno sem Race A → estado "sem-alvo" com mensagem neutra', async () => {
    getProvaAlvoMock.mockResolvedValue(null);
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await waitFor(() => {
      expect(screen.getByTestId('prova-alvo-banner')).toHaveAttribute('data-state', 'sem-alvo');
    });
    expect(screen.getByText(/Sem prova alvo/i)).toBeInTheDocument();
    expect(screen.getByText(/Race A/i)).toBeInTheDocument();
  });
});

// Helper: aguarda o banner sair do estado `loading` e atingir o `data-fase`
// esperado. `findByTestId` por si só retorna o primeiro match (loading)
// e não espera transição — daí o waitFor explícito.
async function aguardarFase(fase: string) {
  await waitFor(() => {
    const banner = screen.getByTestId('prova-alvo-banner');
    expect(banner).toHaveAttribute('data-fase', fase);
  });
  return screen.getByTestId('prova-alvo-banner');
}

describe('ProvaAlvoBanner — fases visuais', () => {
  it('prova a 95 dias → fase=base, sem badge', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(95));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    const banner = await aguardarFase('base');
    expect(banner).toHaveAttribute('data-dias', '95');
    expect(screen.queryByTestId('prova-alvo-banner-badge')).not.toBeInTheDocument();
    expect(screen.getByText(/Race A.*Corrida/i)).toBeInTheDocument();
  });

  it('prova a 20 dias → fase=peak, ainda sem badge', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(20));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await aguardarFase('peak');
    expect(screen.queryByTestId('prova-alvo-banner-badge')).not.toBeInTheDocument();
  });

  it('prova a 10 dias → fase=taper + badge TAPER', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(10));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await aguardarFase('taper');
    expect(screen.getByTestId('prova-alvo-banner-badge')).toHaveTextContent(/TAPER/i);
  });

  it('prova a 4 dias → fase=race-week + badge pulsante', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(4));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await aguardarFase('race-week');
    const badge = screen.getByTestId('prova-alvo-banner-badge');
    expect(badge).toHaveTextContent(/RACE WEEK/i);
    expect(badge.className).toMatch(/animate-pulse/);
  });

  it('prova hoje → fase=race-day + badge "É HOJE" + 🏆', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(0));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await aguardarFase('race-day');
    expect(screen.getByTestId('prova-alvo-banner-badge')).toHaveTextContent(/É HOJE/i);
    expect(screen.getByText(/🏆/)).toBeInTheDocument();
  });

  it('prova passada → fase=post + badge CONCLUÍDA', async () => {
    getProvaAlvoMock.mockResolvedValue(provaDaqui(-3));
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await aguardarFase('post');
    expect(screen.getByTestId('prova-alvo-banner-badge')).toHaveTextContent(/CONCLUÍDA/i);
  });
});

describe('ProvaAlvoBanner — detalhes opcionais', () => {
  it('exibe local + alvoTempo na linha de subtítulo', async () => {
    getProvaAlvoMock.mockResolvedValue(
      provaDaqui(60, { local: 'Florianópolis, SC', alvoTempo: '3:45:00' }),
    );
    render(<ProvaAlvoBanner alunoId="a-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Florianópolis, SC/)).toBeInTheDocument();
    });
    expect(screen.getByText(/alvo 3:45:00/)).toBeInTheDocument();
  });
});

describe('ProvaAlvoBanner — onFaseChange (gancho IA do Coach)', () => {
  it('dispara com (fase, dias, alvo) quando carrega Race A', async () => {
    const alvo = provaDaqui(10);
    getProvaAlvoMock.mockResolvedValue(alvo);
    const onFaseChange = vi.fn();
    render(<ProvaAlvoBanner alunoId="a-1" onFaseChange={onFaseChange} />);
    await waitFor(() => {
      expect(onFaseChange).toHaveBeenCalled();
    });
    const lastCall = onFaseChange.mock.calls[onFaseChange.mock.calls.length - 1];
    expect(lastCall[0]).toBe('taper');
    expect(lastCall[1]).toBe(10);
    expect(lastCall[2]).toMatchObject({ id: 'p-1', nome: 'Maratona Floripa' });
  });

  it('dispara com (null, null, null) quando aluno sem Race A', async () => {
    getProvaAlvoMock.mockResolvedValue(null);
    const onFaseChange = vi.fn();
    render(<ProvaAlvoBanner alunoId="a-1" onFaseChange={onFaseChange} />);
    await waitFor(() => {
      expect(onFaseChange).toHaveBeenCalledWith(null, null, null);
    });
  });

  it('dispara com (null, null, null) quando alunoId esvazia', async () => {
    const onFaseChange = vi.fn();
    const { rerender } = render(
      <ProvaAlvoBanner alunoId="a-1" onFaseChange={onFaseChange} />,
    );
    getProvaAlvoMock.mockResolvedValue(null);
    await waitFor(() => expect(onFaseChange).toHaveBeenCalled());
    onFaseChange.mockClear();
    rerender(<ProvaAlvoBanner alunoId="" onFaseChange={onFaseChange} />);
    expect(onFaseChange).toHaveBeenLastCalledWith(null, null, null);
  });

  // PR #39 — fix Gemini review #3 (Latest Ref Pattern anti-stale-closure).
  // Antes: caller que não memoizava a fn deixava o useEffect chamando a
  // versão velha após re-render do pai. Agora: ref aponta sempre pro
  // último valor; o último callback é chamado quando o fetch resolve.
  it('chama a versão MAIS RECENTE de onFaseChange (sem stale closure)', async () => {
    // Mock que segura o resolve até liberarmos explicitamente — simula
    // pai re-renderizar com nova fn ENQUANTO fetch está em voo.
    let liberar: (v: unknown) => void = () => undefined;
    const pendente = new Promise((resolve) => { liberar = resolve; });
    getProvaAlvoMock.mockReturnValue(pendente);

    const callbackAntigo = vi.fn();
    const callbackNovo = vi.fn();

    const { rerender } = render(
      <ProvaAlvoBanner alunoId="a-1" onFaseChange={callbackAntigo} />,
    );

    // Pai re-render com fn nova ANTES do fetch resolver.
    rerender(
      <ProvaAlvoBanner alunoId="a-1" onFaseChange={callbackNovo} />,
    );

    // Libera o fetch — banner deve chamar a fn NOVA, não a antiga.
    liberar({
      id: 'p-1', alunoId: 'a-1', modalidade: 'CORRIDA',
      nome: 'X', data: new Date(Date.now() + 30 * 86400000).toISOString(),
      prioridade: 'A', arquivada: false, alvoTempo: null, local: null,
      detalhes: {}, criadoEm: '', atualizadoEm: '',
    });

    await waitFor(() => {
      expect(callbackNovo).toHaveBeenCalled();
    });
    // Latest Ref Pattern: o callback OLD nunca dispara com fase carregada.
    expect(callbackAntigo).not.toHaveBeenCalledWith(
      expect.stringMatching(/peak|taper|race/),
      expect.any(Number),
      expect.any(Object),
    );
  });
});
