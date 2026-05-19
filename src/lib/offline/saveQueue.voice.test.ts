import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  base64ToBlob,
  clearQueue,
  enqueueSaveExecucao,
  enqueueVoicePending,
  isSalvarEntry,
  isVoiceEntry,
  listQueue,
} from './saveQueue';

// PR #25 — extension da fila offline pra suportar voice_pending.

afterEach(async () => {
  await clearQueue();
});

beforeEach(async () => {
  await clearQueue();
});

describe('saveQueue — discriminators de kind', () => {
  it('enqueueVoicePending grava entry com kind=voice_pending', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
    const entry = await enqueueVoicePending('treino-x', blob);

    expect(entry.kind).toBe('voice_pending');
    expect(entry.treinoId).toBe('treino-x');
    expect(entry.audioMime).toBe('audio/webm');
    expect(entry.audioBase64).toBeTruthy();
  });

  it('enqueueSaveExecucao grava entry com kind=salvar', async () => {
    const entry = await enqueueSaveExecucao('treino-y', { status: 'CONCLUIDO' });
    expect(entry.kind).toBe('salvar');
  });

  it('isVoiceEntry / isSalvarEntry discriminam corretamente', async () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/webm' });
    await enqueueVoicePending('t-v', blob);
    await enqueueSaveExecucao('t-s', { status: 'CONCLUIDO' });

    const all = await listQueue();
    expect(all).toHaveLength(2);

    const voices = all.filter(isVoiceEntry);
    const saves = all.filter(isSalvarEntry);
    expect(voices).toHaveLength(1);
    expect(saves).toHaveLength(1);
    expect(voices[0].treinoId).toBe('t-v');
    expect(saves[0].treinoId).toBe('t-s');
  });

  it('entries legadas (sem campo kind) contam como salvar', async () => {
    // Simula entry escrita por versão pré-PR #25.
    const idb = await import('idb-keyval');
    await idb.set('apex.offline.exec.legacy-1', {
      id: 'legacy-1',
      treinoId: 't-legacy',
      payload: { status: 'CONCLUIDO' },
      enqueuedAt: new Date().toISOString(),
      // sem kind
    });

    const all = await listQueue();
    expect(all).toHaveLength(1);
    expect(isSalvarEntry(all[0])).toBe(true);
    expect(isVoiceEntry(all[0])).toBe(false);
  });
});

describe('saveQueue — base64 roundtrip', () => {
  it('base64ToBlob recupera bytes idênticos ao original', async () => {
    const original = new Uint8Array([0x1A, 0x45, 0xDF, 0xA3, 0xFF, 0x00, 0x42]);
    const blob = new Blob([original], { type: 'audio/webm' });
    const entry = await enqueueVoicePending('t-roundtrip', blob);

    const restored = base64ToBlob(entry.audioBase64, entry.audioMime);
    expect(restored.type).toBe('audio/webm');
    const buf = new Uint8Array(await restored.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(original));
  });
});
