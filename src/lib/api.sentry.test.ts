import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PR #34 — Confirma que o axios interceptor captura ERR_NETWORK
// no Sentry com contexto enriquecido, mas NÃO captura erros HTTP
// (4xx/5xx têm response — backend Sentry trata).

const captureMock = vi.fn();
vi.mock('@/lib/sentry', () => ({
  captureNetworkError: (err: unknown, ctx: unknown) => captureMock(err, ctx),
  initSentryFrontend: vi.fn(),
}));

// Re-importa api APÓS o mock pra interceptor pegar a versão mockada.
let api: typeof import('./api').api;
beforeEach(async () => {
  captureMock.mockReset();
  vi.resetModules();
  const mod = await import('./api');
  api = mod.api;
});
afterEach(() => vi.restoreAllMocks());

function networkError(code = 'ERR_NETWORK', url = '/treinos', method = 'get'): Error {
  const e = new axios.AxiosError('Network Error');
  e.code = code;
  e.config = { url, method } as never;
  // Sem `response` → axios.isAxiosError(err) && !err.response = network error.
  return e;
}

describe('axios interceptor — ERR_NETWORK captura (PR #34)', () => {
  it('rejeição sem response chama captureNetworkError com contexto', async () => {
    const adapter = vi.fn(() => Promise.reject(networkError('ERR_NETWORK', '/treinos', 'get')));
    await expect(api.get('/treinos', { adapter })).rejects.toBeTruthy();

    expect(captureMock).toHaveBeenCalledOnce();
    const [err, ctx] = captureMock.mock.calls[0];
    expect(err).toBeTruthy();
    expect(ctx.url).toBe('/treinos');
    expect(ctx.method).toBe('GET');
    expect(ctx.code).toBe('ERR_NETWORK');
  });

  it('timeout (ECONNABORTED) também captura', async () => {
    const adapter = vi.fn(() => Promise.reject(networkError('ECONNABORTED', '/voice/parse-bjj', 'post')));
    await expect(api.post('/voice/parse-bjj', {}, { adapter })).rejects.toBeTruthy();

    expect(captureMock).toHaveBeenCalledOnce();
    expect(captureMock.mock.calls[0][1].code).toBe('ECONNABORTED');
    expect(captureMock.mock.calls[0][1].method).toBe('POST');
  });

  it('erro HTTP 500 (COM response) NÃO captura no frontend (backend já reportou)', async () => {
    const adapter = vi.fn(() => Promise.reject({
      isAxiosError: true,
      response: { status: 500, data: {} },
      config: { url: '/x', method: 'get' },
      code: 'ERR_BAD_RESPONSE',
    }));
    await expect(api.get('/x', { adapter })).rejects.toBeTruthy();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it('erro HTTP 403 NÃO captura (rejeição esperada, não bug)', async () => {
    const adapter = vi.fn(() => Promise.reject({
      isAxiosError: true,
      response: { status: 403, data: { message: 'Acesso negado' } },
      config: { url: '/x', method: 'post' },
    }));
    await expect(api.post('/x', {}, { adapter })).rejects.toBeTruthy();
    expect(captureMock).not.toHaveBeenCalled();
  });
});
