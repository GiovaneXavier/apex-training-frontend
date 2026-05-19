import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAllDrafts,
  clearDraft,
  getDraft,
  pruneExpired,
  saveDraft,
} from './voiceDrafts';

// PR #25 — repositório de rascunhos do diário de voz.
// Crítico: o drain processa em background mesmo com JiuJitsuLive
// desmontado. O draft persistido é a ponte entre o pipeline assíncrono
// e o próximo mount do componente.

afterEach(async () => {
  await clearAllDrafts();
  vi.useRealTimers();
});

beforeEach(async () => {
  await clearAllDrafts();
});

describe('voiceDrafts — save/get/clear', () => {
  it('save → get retorna o mesmo payload com processedAt', async () => {
    const saved = await saveDraft('treino-1', {
      fields: { matTimeSegundos: 1500, readinessRating: 7 },
      transcript: null,
      confidence: 0.9,
      needsReview: false,
      warnings: [],
      partial: false,
    });

    expect(saved.processedAt).toBeTruthy();
    const got = await getDraft('treino-1');
    expect(got).not.toBeNull();
    expect(got?.fields.matTimeSegundos).toBe(1500);
    expect(got?.confidence).toBe(0.9);
  });

  it('namespace por treinoId — drafts não colidem', async () => {
    await saveDraft('treino-a', {
      fields: { matTimeSegundos: 1500 }, transcript: null,
      confidence: 0.9, needsReview: false, warnings: [], partial: false,
    });
    await saveDraft('treino-b', {
      fields: { matTimeSegundos: 3000 }, transcript: null,
      confidence: 0.8, needsReview: false, warnings: [], partial: false,
    });

    expect((await getDraft('treino-a'))?.fields.matTimeSegundos).toBe(1500);
    expect((await getDraft('treino-b'))?.fields.matTimeSegundos).toBe(3000);
  });

  it('clearDraft remove apenas o treino alvo', async () => {
    await saveDraft('treino-a', {
      fields: {}, transcript: null,
      confidence: 1, needsReview: false, warnings: [], partial: false,
    });
    await saveDraft('treino-b', {
      fields: {}, transcript: null,
      confidence: 1, needsReview: false, warnings: [], partial: false,
    });

    await clearDraft('treino-a');
    expect(await getDraft('treino-a')).toBeNull();
    expect(await getDraft('treino-b')).not.toBeNull();
  });

  it('getDraft devolve null quando inexistente', async () => {
    expect(await getDraft('inexistente')).toBeNull();
  });
});

describe('voiceDrafts — TTL 7 dias', () => {
  it('draft com >7d → getDraft retorna null E limpa entry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));

    await saveDraft('treino-velho', {
      fields: { matTimeSegundos: 1500 }, transcript: null,
      confidence: 0.9, needsReview: false, warnings: [], partial: false,
    });

    // Avança 8 dias.
    vi.setSystemTime(new Date('2026-01-09T12:00:00Z'));
    const got = await getDraft('treino-velho');
    expect(got).toBeNull();

    // Volta no tempo (defesa-em-profundidade): mesmo se o relógio
    // voltasse, o draft já foi deletado pelo getDraft anterior.
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    expect(await getDraft('treino-velho')).toBeNull();
  });

  it('pruneExpired remove todos os drafts antigos numa varredura', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));

    await saveDraft('antigo-1', {
      fields: {}, transcript: null,
      confidence: 1, needsReview: false, warnings: [], partial: false,
    });
    await saveDraft('antigo-2', {
      fields: {}, transcript: null,
      confidence: 1, needsReview: false, warnings: [], partial: false,
    });

    vi.setSystemTime(new Date('2026-01-20T12:00:00Z'));
    await saveDraft('recente', {
      fields: {}, transcript: null,
      confidence: 1, needsReview: false, warnings: [], partial: false,
    });

    const removed = await pruneExpired();
    expect(removed).toBe(2);
    expect(await getDraft('antigo-1')).toBeNull();
    expect(await getDraft('antigo-2')).toBeNull();
    expect(await getDraft('recente')).not.toBeNull();
  });

  it('draft com processedAt corrompido → expira (defesa)', async () => {
    // Salva normal, depois mexe diretamente no IDB pra simular dado podre.
    const idb = await import('idb-keyval');
    await idb.set('apex.voiceDraft.corrompido', {
      treinoId: 'corrompido',
      fields: {},
      transcript: null,
      confidence: 1,
      needsReview: false,
      warnings: [],
      partial: false,
      processedAt: 'isso-não-é-data',
    });

    expect(await getDraft('corrompido')).toBeNull();
  });
});
