import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearQueue, enqueueSaveExecucao, listQueue } from '@/lib/offline/saveQueue';

// Mock `salvarExecucao` — controlamos sucesso/falha por entry sem rede.
const salvarExecucaoMock = vi.fn();
vi.mock('@/lib/api/execucao', () => ({
  salvarExecucao: (...args: unknown[]) => salvarExecucaoMock(...args),
}));

// Mock dos toasts — verificamos chamadas/argumentos.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// `apiErrorMessage` é usado pra incluir a causa no toast de erro.
vi.mock('@/lib/api', async () => ({
  apiErrorMessage: (err: unknown) =>
    err instanceof Error ? err.message : 'Erro inesperado',
}));

// Importa AFTER mocks. Top-level await é OK em ESM testfile.
const { useOfflineSync } = await import('./useOfflineSync');

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  salvarExecucaoMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  setOnline(true);
});

afterEach(async () => {
  await clearQueue();
});

describe('useOfflineSync — drain order + toast aggregation (PR #12)', () => {
  it('fila vazia: nenhum toast disparado', async () => {
    renderHook(() => useOfflineSync());
    // dá tempo de mount + microtask
    await new Promise((r) => setTimeout(r, 10));
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('drena entries na ordem cronológica (FIFO, não Promise.all)', async () => {
    const a = await enqueueSaveExecucao('t-A', { status: 'CONCLUIDO' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await enqueueSaveExecucao('t-B', { status: 'CONCLUIDO' });
    await new Promise((r) => setTimeout(r, 5));
    const c = await enqueueSaveExecucao('t-C', { status: 'CONCLUIDO' });

    const order: string[] = [];
    salvarExecucaoMock.mockImplementation(async (treinoId: string) => {
      order.push(treinoId);
      return { treino: { id: treinoId }, novosRecordes: [] };
    });

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(salvarExecucaoMock).toHaveBeenCalledTimes(3));
    expect(order).toEqual(['t-A', 't-B', 't-C']);
    // Todas drenaram → fila vazia.
    expect(await listQueue()).toHaveLength(0);
    // Garante que a ordem dos enqueues bateu com a do drain.
    expect([a.id, b.id, c.id]).not.toContain(undefined);
  });

  it('singular: 1 sucesso → toast.success "Treino sincronizado"', async () => {
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    salvarExecucaoMock.mockResolvedValueOnce({ treino: { id: 't' }, novosRecordes: [] });

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith('Treino sincronizado');
  });

  it('plural: N sucessos → toast.success com contagem', async () => {
    await enqueueSaveExecucao('t1', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t2', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t3', { status: 'CONCLUIDO' });
    salvarExecucaoMock.mockResolvedValue({ treino: {}, novosRecordes: [] });

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith('3 treinos sincronizados');
  });

  it('falha em uma entry NÃO interrompe drain das outras', async () => {
    await enqueueSaveExecucao('t1', { status: 'CONCLUIDO' });
    await new Promise((r) => setTimeout(r, 2));
    await enqueueSaveExecucao('t2', { status: 'CONCLUIDO' });
    await new Promise((r) => setTimeout(r, 2));
    await enqueueSaveExecucao('t3', { status: 'CONCLUIDO' });

    salvarExecucaoMock
      .mockResolvedValueOnce({ treino: {}, novosRecordes: [] })
      .mockRejectedValueOnce(new Error('Bad Request — payload inválido'))
      .mockResolvedValueOnce({ treino: {}, novosRecordes: [] });

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(salvarExecucaoMock).toHaveBeenCalledTimes(3));
    // Restou só a entry que falhou
    const rest = await listQueue();
    expect(rest).toHaveLength(1);
    expect(rest[0].treinoId).toBe('t2');
  });

  it('mistura sucesso+falha: dispara apenas toast.error agregado (sucessos ficam silenciados)', async () => {
    await enqueueSaveExecucao('t1', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t2', { status: 'CONCLUIDO' });

    salvarExecucaoMock
      .mockResolvedValueOnce({ treino: {}, novosRecordes: [] })
      .mockRejectedValueOnce(new Error('boom'));

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();

    const [msg, opts] = toastError.mock.calls[0];
    expect(msg).toMatch(/Falha ao sincronizar 1 treino/);
    expect(msg).toMatch(/boom/); // last error embutido
    expect(msg).toMatch(/quando voltar online/);
    expect(opts).toEqual({ duration: 6000 });
  });

  it('múltiplas falhas: pluralização correta', async () => {
    await enqueueSaveExecucao('t1', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t2', { status: 'CONCLUIDO' });
    salvarExecucaoMock.mockRejectedValue(new Error('rede caiu'));

    renderHook(() => useOfflineSync());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/2 treinos/);
  });

  it('offline no mount: NÃO tenta drenar', async () => {
    setOnline(false);
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });

    renderHook(() => useOfflineSync());
    await new Promise((r) => setTimeout(r, 10));

    expect(salvarExecucaoMock).not.toHaveBeenCalled();
    expect(await listQueue()).toHaveLength(1);
  });

  it('evento "online" dispara nova tentativa de drain', async () => {
    setOnline(false);
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });

    renderHook(() => useOfflineSync());
    await new Promise((r) => setTimeout(r, 10));
    expect(salvarExecucaoMock).not.toHaveBeenCalled();

    salvarExecucaoMock.mockResolvedValueOnce({ treino: {}, novosRecordes: [] });
    setOnline(true);
    window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(salvarExecucaoMock).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith('Treino sincronizado');
  });

  it('unmount remove listener (não vaza handler entre testes)', async () => {
    const { unmount } = renderHook(() => useOfflineSync());
    unmount();

    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    window.dispatchEvent(new Event('online'));
    await new Promise((r) => setTimeout(r, 10));

    expect(salvarExecucaoMock).not.toHaveBeenCalled();
  });
});
