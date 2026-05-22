import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ConquistaItem } from '@/lib/api/conquistas';

import { ConquistaBadge } from './ConquistaBadge';

function makeConquista(over: Partial<ConquistaItem> = {}): ConquistaItem {
  return {
    codigo: 'STREAK_4_SEMANAS',
    titulo: '4 semanas consecutivas',
    descricao: '1 mês de consistência.',
    hintLocked: 'Mantenha o ritmo.',
    tier: 'bronze',
    icone: '🥉',
    desbloqueada: true,
    desbloqueadoEm: '2026-05-15T10:00:00Z',
    ...over,
  };
}

describe('ConquistaBadge (PR #31)', () => {
  it('desbloqueada: mostra descricao completa + data, data-desbloqueada=true', () => {
    render(<ConquistaBadge conquista={makeConquista()} />);
    const badge = screen.getByTestId('conquista-STREAK_4_SEMANAS');
    expect(badge).toHaveAttribute('data-desbloqueada', 'true');
    expect(screen.getByText(/1 mês de consistência/i)).toBeInTheDocument();
    expect(screen.getByText(/15\/05\/2026/)).toBeInTheDocument();
  });

  it('locked: substitui descricao por hintLocked, sem data', () => {
    render(<ConquistaBadge conquista={makeConquista({ desbloqueada: false, desbloqueadoEm: null })} />);
    const badge = screen.getByTestId('conquista-STREAK_4_SEMANAS');
    expect(badge).toHaveAttribute('data-desbloqueada', 'false');
    expect(screen.getByText(/Mantenha o ritmo/i)).toBeInTheDocument();
    expect(screen.queryByText(/15\/05\/2026/)).not.toBeInTheDocument();
  });

  it('data-tier reflete o tier do catálogo', () => {
    render(<ConquistaBadge conquista={makeConquista({ tier: 'ouro' })} />);
    expect(screen.getByTestId('conquista-STREAK_4_SEMANAS')).toHaveAttribute('data-tier', 'ouro');
  });

  it('destaque=true → data-destaque=true', () => {
    render(<ConquistaBadge conquista={makeConquista()} destaque />);
    expect(screen.getByTestId('conquista-STREAK_4_SEMANAS')).toHaveAttribute('data-destaque', 'true');
  });

  it('destaque ausente → atributo não presente', () => {
    render(<ConquistaBadge conquista={makeConquista()} />);
    expect(screen.getByTestId('conquista-STREAK_4_SEMANAS')).not.toHaveAttribute('data-destaque');
  });
});
