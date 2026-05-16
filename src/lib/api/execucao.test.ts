import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearQueue, listQueue } from '@/lib/offline/saveQueue';

import { salvarExecucaoOfflineFirst } from './execucao';

// `salvarExecucao` faz POST via `api` (axios singleton). Mockamos o
// método para controlar a resposta sem subir backend.
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...real,
    api: { post: vi.fn() },
  };
});

const apiMock = await import('@/lib/api').then(
  (m) => m.api as unknown as { post: ReturnType<typeof vi.fn> },
);

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

function networkError(): Error {
  // Erro de transporte real do axios: tem isAxiosError mas sem `response`.
  return new axios.AxiosError('Network Error');
}

afterEach(async () => {
  vi.restoreAllMocks();
  apiMock.post.mockReset();
  await clearQueue();
});

beforeEach(() => {
  setOnline(true);
});

describe('salvarExecucaoOfflineFirst', () => {
  it('online + sucesso → kind=synced e nada enfileirado', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { treino: { id: 't' }, novosRecordes: [] },
    });

    const result = await salvarExecucaoOfflineFirst('t', { status: 'CONCLUIDO' });

    expect(result.kind).toBe('synced');
    expect(await listQueue()).toHaveLength(0);
  });

  it('navigator.onLine=false → enfileira sem chamar a rede', async () => {
    setOnline(false);

    const result = await salvarExecucaoOfflineFirst('t', { status: 'CONCLUIDO' });

    expect(result.kind).toBe('queued');
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(await listQueue()).toHaveLength(1);
  });

  it('online mas rede falha (ERR_NETWORK) → enfileira', async () => {
    apiMock.post.mockRejectedValueOnce(networkError());

    const result = await salvarExecucaoOfflineFirst('t', { status: 'CONCLUIDO' });

    expect(result.kind).toBe('queued');
    expect(await listQueue()).toHaveLength(1);
  });

  it('online + 400 backend → rethrow, NÃO enfileira', async () => {
    const httpErr = new axios.AxiosError('Bad Request');
    httpErr.response = {
      status: 400,
      data: { error: 'ValidationError' },
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
    };
    apiMock.post.mockRejectedValueOnce(httpErr);

    await expect(
      salvarExecucaoOfflineFirst('t', { status: 'CONCLUIDO' }),
    ).rejects.toBeTruthy();
    expect(await listQueue()).toHaveLength(0);
  });
});
