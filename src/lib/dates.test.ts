import { describe, expect, it } from 'vitest';

import { comHoraAtual, fimSemana, inicioSemana, key, mesmaData } from './dates';

describe('inicioSemana — padrão BR (segunda 00:00 local)', () => {
  it('quarta-feira 14:23 → segunda da mesma semana às 00:00', () => {
    const qua = new Date('2026-05-13T14:23:45'); // qua
    const out = inicioSemana(qua);
    expect(out.getDay()).toBe(1); // segunda
    expect(out.getHours()).toBe(0);
    expect(out.getMinutes()).toBe(0);
    expect(out.getDate()).toBe(11);
  });

  it('segunda → ela mesma 00:00', () => {
    const seg = new Date('2026-05-11T08:00:00');
    const out = inicioSemana(seg);
    expect(out.getDate()).toBe(11);
    expect(out.getHours()).toBe(0);
  });

  it('domingo → segunda ANTERIOR (não pula para a próxima)', () => {
    const dom = new Date('2026-05-17T23:00:00');
    const out = inicioSemana(dom);
    expect(out.getDay()).toBe(1);
    expect(out.getDate()).toBe(11); // 6 dias antes
  });

  it('sem argumento → segunda da semana corrente', () => {
    const out = inicioSemana();
    expect(out.getDay()).toBe(1);
    expect(out.getHours()).toBe(0);
  });
});

describe('fimSemana — próxima segunda exclusiva', () => {
  it('é 7 dias depois do inicioSemana', () => {
    const ref = new Date('2026-05-13T14:00:00');
    const ini = inicioSemana(ref);
    const fim = fimSemana(ref);
    expect(fim.getTime() - ini.getTime()).toBe(7 * 86_400_000);
    expect(fim.getDay()).toBe(1);
  });
});

describe('key — YYYY-MM-DD local', () => {
  it('formata zero-pad', () => {
    expect(key(new Date('2026-01-05T12:00:00'))).toBe('2026-01-05');
  });
});

describe('mesmaData — ignora hora', () => {
  it('mesmo dia, horas diferentes → true', () => {
    expect(
      mesmaData(new Date('2026-05-13T01:00:00'), new Date('2026-05-13T23:59:59')),
    ).toBe(true);
  });
  it('dias adjacentes → false', () => {
    expect(
      mesmaData(new Date('2026-05-13T23:59:59'), new Date('2026-05-14T00:00:00')),
    ).toBe(false);
  });
});

describe('comHoraAtual — preserva dia, usa hora real (PR #14 audit 4.19)', () => {
  it('mantém a data civil do dia base', () => {
    const dia = new Date('2026-05-13T00:00:00');
    const out = comHoraAtual(dia);
    expect(out.getFullYear()).toBe(2026);
    expect(out.getMonth()).toBe(4); // maio
    expect(out.getDate()).toBe(13);
  });

  it('substitui hora/minuto pela hora ATUAL do dispositivo (não 7AM)', () => {
    const agora = new Date();
    const dia = new Date('2026-05-13T00:00:00');
    const out = comHoraAtual(dia);
    expect(out.getHours()).toBe(agora.getHours());
    expect(Math.abs(out.getMinutes() - agora.getMinutes())).toBeLessThan(2);
    expect(out.getMilliseconds()).toBe(0); // zerado pra ISO clean
  });

  it('não muta o argumento de entrada', () => {
    const dia = new Date('2026-05-13T00:00:00');
    const original = dia.getTime();
    comHoraAtual(dia);
    expect(dia.getTime()).toBe(original);
  });
});
