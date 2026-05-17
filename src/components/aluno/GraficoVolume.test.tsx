import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GraficoVolume } from './GraficoVolume';

// PR #20 — testes do GraficoVolume. Foco no fluxo de tabs (escala
// correta por modalidade), empty state e formatação de totais.
// Recharts é mockado pra evitar overhead de SVG no jsdom.

const getVolumeSeriesMock = vi.fn();
vi.mock('@/lib/api/desempenho', () => ({
  getVolumeSeries: (...args: unknown[]) => getVolumeSeriesMock(...args),
}));

// Recharts em jsdom: o ResponsiveContainer mede width=0 e não renderiza
// os filhos. Trocamos pelo passthrough simples.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="barchart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

function makeSerie(overrides: Partial<Record<string, number>>[] = []) {
  return {
    weeks: 12,
    series: Array.from({ length: 12 }, (_, i) => ({
      semana: `2026-0${1 + Math.floor(i / 4)}-0${1 + (i % 4)}`,
      corridaKm: 0,
      ciclismoKm: 0,
      natacaoM: 0,
      musculacaoKg: 0,
      ...(overrides[i] ?? {}),
    })),
  };
}

beforeEach(() => {
  getVolumeSeriesMock.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('GraficoVolume — fetch + tabs', () => {
  it('chama o endpoint uma vez no mount (12 semanas)', async () => {
    getVolumeSeriesMock.mockResolvedValueOnce(makeSerie());
    render(<GraficoVolume />);
    await waitFor(() => expect(getVolumeSeriesMock).toHaveBeenCalledTimes(1));
    const callArgs = getVolumeSeriesMock.mock.calls[0];
    expect(callArgs[0]).toBeUndefined(); // alunoId default
    expect(callArgs[1]?.weeks).toBe(12);
  });

  it('mostra todas as 4 tabs (corrida, ciclismo, natação, musculação)', async () => {
    // Tabs ficam visíveis independente de ter dados — empty state é
    // mostrado embaixo só quando todos zero. Tabs no header sempre.
    getVolumeSeriesMock.mockResolvedValueOnce(makeSerie([{ corridaKm: 1 }]));
    render(<GraficoVolume />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Corrida/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('tab', { name: /Ciclismo/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Natação/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Musculação/i })).toBeInTheDocument();
  });

  it('trocar de tab NÃO refaz fetch (cliente filtra)', async () => {
    getVolumeSeriesMock.mockResolvedValueOnce(makeSerie([{ corridaKm: 1 }, { ciclismoKm: 2 }]));
    render(<GraficoVolume />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Ciclismo/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('tab', { name: /Ciclismo/i }));
    await userEvent.click(screen.getByRole('tab', { name: /Natação/i }));
    expect(getVolumeSeriesMock).toHaveBeenCalledTimes(1);
  });
});

describe('GraficoVolume — empty state + totais', () => {
  it('série toda zerada → empty state amigável', async () => {
    getVolumeSeriesMock.mockResolvedValueOnce(makeSerie()); // tudo zero
    render(<GraficoVolume />);
    await waitFor(() => expect(screen.getByText(/sem registros/i)).toBeInTheDocument());
    expect(screen.getByText(/12 semanas/i)).toBeInTheDocument();
  });

  it('corrida com dados → mostra total formatado em km', async () => {
    const serie = makeSerie([
      { corridaKm: 10 }, { corridaKm: 12 }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    getVolumeSeriesMock.mockResolvedValueOnce(serie);
    render(<GraficoVolume />);
    await waitFor(() => expect(screen.getByText(/total/i)).toBeInTheDocument());
    // total = 22 km → formatado como "22.0"
    expect(screen.getByText(/22\.0/)).toBeInTheDocument();
    expect(screen.getAllByText('km').length).toBeGreaterThan(0);
  });

  it('musculação com tonelagem grande → formata com vírgula PT-BR', async () => {
    // Total 24500 kg → "24.500" no formato PT-BR
    const serie = makeSerie([
      { musculacaoKg: 12000 }, { musculacaoKg: 12500 },
      {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    getVolumeSeriesMock.mockResolvedValueOnce(serie);
    render(<GraficoVolume />);

    await userEvent.click(await screen.findByRole('tab', { name: /Musculação/i }));
    await waitFor(() => expect(screen.getByText(/24\.500/)).toBeInTheDocument());
    expect(screen.getAllByText('kg').length).toBeGreaterThan(0);
  });

  it('pico semanal aparece destacado em coral', async () => {
    const serie = makeSerie([
      { corridaKm: 5 }, { corridaKm: 18 }, { corridaKm: 8 },
      {}, {}, {}, {}, {}, {}, {}, {}, {},
    ]);
    getVolumeSeriesMock.mockResolvedValueOnce(serie);
    render(<GraficoVolume />);
    await waitFor(() => expect(screen.getByText(/Pico semanal/i)).toBeInTheDocument());
    expect(screen.getByText(/18\.0 km/)).toBeInTheDocument();
  });
});

describe('GraficoVolume — erro', () => {
  it('falha na API → exibe mensagem do apiErrorMessage', async () => {
    getVolumeSeriesMock.mockRejectedValueOnce(new Error('Tempo esgotado'));
    render(<GraficoVolume />);
    await waitFor(() => expect(screen.getByText(/Tempo esgotado/i)).toBeInTheDocument());
  });
});
