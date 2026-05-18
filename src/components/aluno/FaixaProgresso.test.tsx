import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FaixaProgresso, FaixaVisual, fmtHorasCompactas } from './FaixaProgresso';

// PR #24 — testa empty state, faixa visual com stripes, agregação de
// jornada (faixa atual + progresso + meta) e formatação de horas.

const getJornadaMock = vi.fn();
vi.mock('@/lib/api/marcial', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api/marcial')>();
  return {
    ...real,
    getJornadaMarcial: (...args: unknown[]) => getJornadaMock(...args),
    registrarPromocao: vi.fn(),
  };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  getJornadaMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('FaixaVisual — stripes (PR #24)', () => {
  it('renderiza 4 stripes sempre (preenchidas e vazias)', () => {
    render(<FaixaVisual faixa="AZUL" grauNum={2} />);
    expect(screen.getByTestId('stripe-0')).toBeInTheDocument();
    expect(screen.getByTestId('stripe-1')).toBeInTheDocument();
    expect(screen.getByTestId('stripe-2')).toBeInTheDocument();
    expect(screen.getByTestId('stripe-3')).toBeInTheDocument();
  });

  it('com grauNum=2 → 2 stripes brancas + 2 esmaecidas', () => {
    render(<FaixaVisual faixa="AZUL" grauNum={2} />);
    expect(screen.getByTestId('stripe-0').className).toMatch(/bg-white(?!\/)/);
    expect(screen.getByTestId('stripe-1').className).toMatch(/bg-white(?!\/)/);
    expect(screen.getByTestId('stripe-2').className).toMatch(/bg-white\/15/);
    expect(screen.getByTestId('stripe-3').className).toMatch(/bg-white\/15/);
  });

  it('com grauNum=0 → todas esmaecidas', () => {
    render(<FaixaVisual faixa="BRANCA" grauNum={0} />);
    for (let i = 0; i < 4; i++) {
      expect(screen.getByTestId(`stripe-${i}`).className).toMatch(/bg-white\/15/);
    }
  });

  it('aria-label inclui faixa e grau', () => {
    render(<FaixaVisual faixa="ROXA" grauNum={3} />);
    expect(screen.getByTestId('faixa-visual')).toHaveAttribute(
      'aria-label',
      'Faixa Roxa 3 graus',
    );
  });

  it('grau singular', () => {
    render(<FaixaVisual faixa="MARROM" grauNum={1} />);
    expect(screen.getByTestId('faixa-visual')).toHaveAttribute(
      'aria-label',
      'Faixa Marrom 1 grau',
    );
  });
});

describe('FaixaProgresso — empty state', () => {
  it('atleta sem promoção → CTA + Registrar faixa', async () => {
    getJornadaMock.mockResolvedValueOnce({
      faixaAtual: null,
      matTimeNaFaixaSeg: 0,
      proximaFaixa: null,
      metaSegundos: null,
      progressoPct: 0,
    });
    render(<FaixaProgresso />);
    await waitFor(() =>
      expect(screen.getByText(/Sem promoção registrada/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Registrar faixa/i })).toBeInTheDocument();
  });
});

describe('FaixaProgresso — atleta com faixa', () => {
  it('AZUL com 100h → barra 25% + meta 400h', async () => {
    getJornadaMock.mockResolvedValueOnce({
      faixaAtual: {
        id: 'p1', alunoId: 'a-1',
        faixa: 'AZUL', grauNum: 2,
        dataPromocao: '2025-06-01T10:00:00Z',
        instrutorNome: 'Mestre X',
        observacao: null, criadoEm: '2025-06-01T10:00:00Z',
      },
      matTimeNaFaixaSeg: 100 * 3600,
      proximaFaixa: 'ROXA',
      metaSegundos: 400 * 3600,
      progressoPct: 25,
    });
    render(<FaixaProgresso />);
    await waitFor(() =>
      expect(screen.getByText(/Faixa atual · Azul/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/100h/)).toBeInTheDocument();
    expect(screen.getByText(/Próxima · Roxa/i)).toBeInTheDocument();
    expect(screen.getByText(/meta 400h/i)).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Barra de progresso com width 25%
    const barra = screen.getByTestId('barra-progresso');
    expect(barra).toHaveStyle({ width: '25%' });
    expect(barra).toHaveAttribute('aria-valuenow', '25');

    // Instrutor exibido
    expect(screen.getByText(/Mestre X/)).toBeInTheDocument();
  });

  it('PRETA → mensagem endgame, sem barra', async () => {
    getJornadaMock.mockResolvedValueOnce({
      faixaAtual: {
        id: 'p1', alunoId: 'a-1', faixa: 'PRETA', grauNum: 1,
        dataPromocao: '2024-12-01T10:00:00Z',
        instrutorNome: null, observacao: null, criadoEm: '2024-12-01T10:00:00Z',
      },
      matTimeNaFaixaSeg: 200 * 3600,
      proximaFaixa: null,
      metaSegundos: null,
      progressoPct: 0,
    });
    render(<FaixaProgresso />);
    await waitFor(() =>
      expect(screen.getByText(/Endgame/i)).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('barra-progresso')).not.toBeInTheDocument();
    expect(screen.getByText(/200h/)).toBeInTheDocument();
  });

  it('progresso 100% (ultrapassou meta) → barra cheia', async () => {
    getJornadaMock.mockResolvedValueOnce({
      faixaAtual: {
        id: 'p1', alunoId: 'a-1', faixa: 'BRANCA', grauNum: 4,
        dataPromocao: '2023-01-01T10:00:00Z',
        instrutorNome: null, observacao: null, criadoEm: '2023-01-01T10:00:00Z',
      },
      matTimeNaFaixaSeg: 999 * 3600,
      proximaFaixa: 'AZUL',
      metaSegundos: 200 * 3600,
      progressoPct: 100,
    });
    render(<FaixaProgresso />);
    await waitFor(() =>
      expect(screen.getByText('100%')).toBeInTheDocument(),
    );
    const barra = screen.getByTestId('barra-progresso');
    expect(barra).toHaveStyle({ width: '100%' });
  });
});

describe('fmtHorasCompactas', () => {
  it('horas < 1 → "< 1h"', () => {
    expect(fmtHorasCompactas(0.4)).toBe('< 1h');
  });
  it('horas 1..999 → "Nh"', () => {
    expect(fmtHorasCompactas(45)).toBe('45h');
    expect(fmtHorasCompactas(150.5)).toBe('151h');
  });
  it('horas >= 1000 → "1.2k h"', () => {
    expect(fmtHorasCompactas(1200)).toBe('1.2k h');
    expect(fmtHorasCompactas(3500)).toBe('3.5k h');
  });
});
