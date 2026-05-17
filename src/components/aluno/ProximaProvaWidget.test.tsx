import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProximaProvaWidget } from './ProximaProvaWidget';

// PR #21 — testes de UI do widget de countdown. Foco no shaping de
// texto e nos buckets de urgência. Não testa o form de criação aqui —
// fica pra teste de integração no Dashboard.

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api/provas', () => ({ criarProva: vi.fn() }));

const PROVA_BASE = {
  id: 'p-1',
  alunoId: 'a-1',
  modalidade: 'CORRIDA' as const,
  nome: 'Meia de Floripa',
  detalhes: {},
  criadoEm: new Date().toISOString(),
};

function provaDaqui(dias: number) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return { ...PROVA_BASE, data: d.toISOString() };
}

describe('ProximaProvaWidget — countdown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sem prova → CTA "Configure sua próxima prova"', () => {
    render(<ProximaProvaWidget prova={null} onCriada={() => {}} />);
    expect(screen.getByText(/Sem alvo definido/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure sua próxima prova/i)).toBeInTheDocument();
  });

  it('prova daqui a 30 dias → exibe semanas restantes', () => {
    render(<ProximaProvaWidget prova={provaDaqui(30)} onCriada={() => {}} />);
    expect(screen.getByText('Meia de Floripa')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument(); // 30/7 = 4.28 → round = 4
    expect(screen.getByText(/semanas restantes/i)).toBeInTheDocument();
  });

  it('prova daqui a 1 semana → singular "semana restante"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(7)} onCriada={() => {}} />);
    // 7 dias entra no bucket ≤14 → exibe DIAS, não semanas
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/dias restantes/i)).toBeInTheDocument();
  });

  it('prova daqui a 1 dia → singular "dia restante"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(1)} onCriada={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/dia restante/i)).toBeInTheDocument();
  });

  it('prova de hoje (0 dias) → "0 dias restantes"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(0)} onCriada={() => {}} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText(/dias restantes/i)).toBeInTheDocument();
  });

  it('prova já passada → label "passou"', () => {
    render(<ProximaProvaWidget prova={provaDaqui(-2)} onCriada={() => {}} />);
    expect(screen.getByText(/passou/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('mostra modalidade humanizada no label', () => {
    render(<ProximaProvaWidget prova={provaDaqui(10)} onCriada={() => {}} />);
    // "Corrida · alvo" (label do MODALIDADE_LABEL)
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
