import { afterEach, describe, expect, it } from 'vitest';

import {
  clearQueue,
  enqueueSaveExecucao,
  listQueue,
  queueSize,
  removeEntry,
} from './saveQueue';

afterEach(async () => {
  await clearQueue();
});

describe('saveQueue', () => {
  it('enqueue cria entry com id, treinoId, payload e enqueuedAt ISO', async () => {
    const entry = await enqueueSaveExecucao('treino-1', { status: 'CONCLUIDO' });
    expect(entry.id).toBeTruthy();
    expect(entry.treinoId).toBe('treino-1');
    expect(entry.payload).toEqual({ status: 'CONCLUIDO' });
    expect(() => new Date(entry.enqueuedAt).toISOString()).not.toThrow();
  });

  it('listQueue retorna entries ordenadas por enqueuedAt asc', async () => {
    const a = await enqueueSaveExecucao('t-A', { status: 'CONCLUIDO' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await enqueueSaveExecucao('t-B', { status: 'CONCLUIDO' });

    const list = await listQueue();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(a.id);
    expect(list[1].id).toBe(b.id);
  });

  it('removeEntry é idempotente — chamar 2x não explode', async () => {
    const e = await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    await removeEntry(e.id);
    await removeEntry(e.id);
    expect(await queueSize()).toBe(0);
  });

  it('queueSize reflete enqueue/remove', async () => {
    expect(await queueSize()).toBe(0);
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    expect(await queueSize()).toBe(2);
  });

  it('clearQueue remove tudo', async () => {
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });
    await clearQueue();
    expect(await listQueue()).toEqual([]);
  });

  it('chaves de outros namespaces no IDB não vazam para listQueue', async () => {
    // Simula coexistência com outra feature gravando no mesmo IDB.
    const { set } = await import('idb-keyval');
    await set('outra-feature.xyz', { foo: 1 });
    await enqueueSaveExecucao('t', { status: 'CONCLUIDO' });

    const list = await listQueue();
    expect(list).toHaveLength(1);
    expect(list[0].treinoId).toBe('t');
  });
});
