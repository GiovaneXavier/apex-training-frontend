import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock do módulo virtual do vite-plugin-pwa — sem isto, o import resolve só
// no build (vite gera o virtual:pwa-register/react). Simulamos o hook
// retornando estado idle (não há update nem offline ready).
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

import { ReloadPrompt } from './ReloadPrompt';

describe('ReloadPrompt — smoke', () => {
  it('renderiza sem quebrar e não mostra toast quando idle', () => {
    const { container } = render(<ReloadPrompt />);
    // Sem needRefresh nem offlineReady o componente retorna null
    expect(container.firstChild).toBeNull();
  });
});
