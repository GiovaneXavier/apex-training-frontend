import { afterEach, describe, expect, it, vi } from 'vitest';

import { __internal } from './sentry';

// PR #34 — Filtro de ruído do Sentry. Casos baseados em incidência real
// de PWA em campo (ad-blockers, extensões, ResizeObserver warnings).

afterEach(() => vi.restoreAllMocks());

describe('isNoise — filtro beforeSend (PR #34)', () => {
  it('descarta erro vindo de chrome-extension://', () => {
    const ev = {
      exception: {
        values: [{
          type: 'TypeError',
          value: 'Cannot read properties of undefined',
          stacktrace: { frames: [{ filename: 'chrome-extension://abc/contentScript.js' }] },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(true);
  });

  it('descarta erro vindo de moz-extension://', () => {
    const ev = {
      exception: {
        values: [{
          type: 'Error',
          value: 'AdBlock blocked',
          stacktrace: { frames: [{ filename: 'moz-extension://xyz/content.js' }] },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(true);
  });

  it('descarta ResizeObserver loop limit exceeded (warning benigno)', () => {
    const ev = {
      exception: {
        values: [{
          type: 'Error',
          value: 'ResizeObserver loop limit exceeded',
          stacktrace: { frames: [] },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(true);
  });

  it('descarta ResizeObserver loop completed with undelivered notifications', () => {
    const ev = {
      exception: {
        values: [{
          type: 'Error',
          value: 'ResizeObserver loop completed with undelivered notifications.',
          stacktrace: { frames: [] },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(true);
  });

  it('PRESERVA erro de aplicação genuíno', () => {
    const ev = {
      exception: {
        values: [{
          type: 'TypeError',
          value: 'Cannot read properties of null (reading "id")',
          stacktrace: { frames: [{ filename: '/assets/index-abc.js' }] },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(false);
  });

  it('PRESERVA quando exception.values vazio (não é spam, é genuíno)', () => {
    const ev = { exception: { values: [] } };
    expect(__internal.isNoise(ev)).toBe(false);
  });

  it('PRESERVA quando event não tem exception (event manual capturado)', () => {
    const ev = { message: 'manual log' };
    expect(__internal.isNoise(ev)).toBe(false);
  });

  it('detecta extension mesmo quando filename vem no stack frame', () => {
    const ev = {
      exception: {
        values: [{
          type: 'ReferenceError',
          value: 'foo is not defined',
          stacktrace: {
            frames: [
              { filename: '/assets/main.js' },
              { filename: 'chrome-extension://abc/injected.js' },
            ],
          },
        }],
      },
    };
    expect(__internal.isNoise(ev)).toBe(true);
  });
});

describe('NOISE_PATTERNS — cobertura mínima', () => {
  it('cobre chrome/moz/safari extensions + ResizeObserver', () => {
    const patterns = __internal.NOISE_PATTERNS.map((p) => p.source);
    expect(patterns.some((p) => p.includes('chrome-extension'))).toBe(true);
    expect(patterns.some((p) => p.includes('moz-extension'))).toBe(true);
    expect(patterns.some((p) => p.includes('safari-extension'))).toBe(true);
    expect(patterns.some((p) => p.includes('ResizeObserver'))).toBe(true);
  });
});
