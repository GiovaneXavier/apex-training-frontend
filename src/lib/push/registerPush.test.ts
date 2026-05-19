import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PR #26 — testa detecção iOS e cálculo de status. subscribe()/unsubscribe()
// dependem de SW + PushManager reais que jsdom não tem; testamos via
// mock orquestrado nos pontos de integração.

vi.mock('@/lib/api/push', () => ({
  fetchVapidPublicKey: vi.fn(),
  postSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}));

import { getStatus, isPushSupported, __internal } from './registerPush';
import { fetchVapidPublicKey, postSubscription } from '@/lib/api/push';

const fetchVapidMock = fetchVapidPublicKey as unknown as ReturnType<typeof vi.fn>;
const postSubMock = postSubscription as unknown as ReturnType<typeof vi.fn>;

function setUserAgent(ua: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => ua });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, get: () => maxTouchPoints });
}

function setStandalone(value: boolean) {
  const nav = navigator as Navigator & { standalone?: boolean };
  Object.defineProperty(nav, 'standalone', { configurable: true, get: () => value });
}

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function deleteFromWindow(key: string) {
  // jsdom: deletar globals exige delete via cast.
  delete (window as unknown as Record<string, unknown>)[key];
}

afterEach(() => {
  vi.clearAllMocks();
  setStandalone(false);
  setMatchMedia(false);
});

describe('isPushSupported', () => {
  it('false quando PushManager indisponível', () => {
    deleteFromWindow('PushManager');
    expect(isPushSupported()).toBe(false);
  });
});

describe('__internal.isIOSSafari — detecção iOS', () => {
  it('reconhece Safari iPhone', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 Version/16.4 Mobile/15E148 Safari/604.1',
    );
    expect(__internal.isIOSSafari()).toBe(true);
  });

  it('reconhece iPad masquerading como Mac (iPadOS 13+) via maxTouchPoints', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.4 Safari/605.1.15',
      5,
    );
    expect(__internal.isIOSSafari()).toBe(true);
  });

  it('rejeita Chrome iOS (CriOS)', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1',
    );
    expect(__internal.isIOSSafari()).toBe(false);
  });

  it('rejeita Mac desktop Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/16.4 Safari/605.1.15',
      0,
    );
    expect(__internal.isIOSSafari()).toBe(false);
  });

  it('rejeita Android Chrome', () => {
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
    );
    expect(__internal.isIOSSafari()).toBe(false);
  });
});

describe('__internal.isStandalonePWA', () => {
  it('true quando navigator.standalone=true (iOS)', () => {
    setStandalone(true);
    expect(__internal.isStandalonePWA()).toBe(true);
  });

  it('true quando display-mode standalone (Chrome/Edge)', () => {
    setStandalone(false);
    setMatchMedia(true);
    expect(__internal.isStandalonePWA()).toBe(true);
  });

  it('false em tab normal', () => {
    setStandalone(false);
    setMatchMedia(false);
    expect(__internal.isStandalonePWA()).toBe(false);
  });
});

describe('__internal.urlBase64ToUint8Array', () => {
  it('converte base64url com padding implícito', () => {
    // "hello" em base64url = "aGVsbG8" (sem padding)
    const out = __internal.urlBase64ToUint8Array('aGVsbG8');
    expect(Array.from(out)).toEqual([104, 101, 108, 108, 111]);
  });

  it('converte caracteres - e _ (urlsafe)', () => {
    // bytes [251, 240] → base64 "+/A=" → base64url "-_A="
    const out = __internal.urlBase64ToUint8Array('-_A');
    expect(Array.from(out)).toEqual([251, 240]);
  });
});

describe('getStatus — 5 estados', () => {
  it('iOS Safari sem PushManager + sem standalone → ios-needs-install', async () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    );
    deleteFromWindow('PushManager');
    setStandalone(false);
    setMatchMedia(false);
    expect(await getStatus()).toBe('ios-needs-install');
  });

  it('browser sem PushManager (não-iOS) → unsupported', async () => {
    setUserAgent('Mozilla/5.0 BrowserAntigo/1.0');
    deleteFromWindow('PushManager');
    expect(await getStatus()).toBe('unsupported');
  });
});

describe('subscribe — pipeline mockado', () => {
  beforeEach(() => {
    fetchVapidMock.mockResolvedValue('BTestKey_AAA_BBB_CCC');
    postSubMock.mockResolvedValue(undefined);
  });

  it('throw com code=unsupported quando push não suportado', async () => {
    deleteFromWindow('PushManager');
    const { subscribe } = await import('./registerPush');
    await expect(subscribe()).rejects.toMatchObject({ code: 'unsupported' });
  });
});
