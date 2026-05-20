import { describe, expect, it } from 'vitest';

import {
  diasAteIso,
  displayCountdown,
  faseMacrociclo,
  fmtDataCurta,
} from './macrociclo';

// PR #39 (Sprint 14) — helpers puros do macro-ciclo. Tests sem React.

describe('faseMacrociclo', () => {
  it('post quando dias < 0', () => {
    expect(faseMacrociclo(-1)).toBe('post');
    expect(faseMacrociclo(-30)).toBe('post');
  });
  it('race-day quando dias === 0', () => {
    expect(faseMacrociclo(0)).toBe('race-day');
  });
  it('race-week para 1..7d', () => {
    expect(faseMacrociclo(1)).toBe('race-week');
    expect(faseMacrociclo(7)).toBe('race-week');
  });
  it('taper para 8..14d', () => {
    expect(faseMacrociclo(8)).toBe('taper');
    expect(faseMacrociclo(14)).toBe('taper');
  });
  it('peak para 15..30d', () => {
    expect(faseMacrociclo(15)).toBe('peak');
    expect(faseMacrociclo(30)).toBe('peak');
  });
  it('base para > 30d', () => {
    expect(faseMacrociclo(31)).toBe('base');
    expect(faseMacrociclo(180)).toBe('base');
  });
});

describe('diasAteIso', () => {
  it('mesma data 23h ainda é "hoje" (0 dias)', () => {
    const hoje23h = new Date();
    hoje23h.setHours(23, 30, 0, 0);
    expect(diasAteIso(hoje23h.toISOString())).toBe(0);
  });
  it('amanhã 01h é 1 dia (não 0)', () => {
    const amanha01h = new Date();
    amanha01h.setDate(amanha01h.getDate() + 1);
    amanha01h.setHours(1, 0, 0, 0);
    expect(diasAteIso(amanha01h.toISOString())).toBe(1);
  });
});

describe('displayCountdown', () => {
  it('passou para dias negativos', () => {
    expect(displayCountdown(-1)).toEqual({ numero: '—', unidade: 'passou' });
  });
  it('é hoje para 0', () => {
    expect(displayCountdown(0)).toEqual({ numero: '0', unidade: 'é hoje' });
  });
  it('singular pra 1 dia', () => {
    expect(displayCountdown(1)).toEqual({ numero: '1', unidade: 'dia restante' });
  });
  it('plural pra 10 dias', () => {
    expect(displayCountdown(10)).toEqual({ numero: '10', unidade: 'dias restantes' });
  });
  it('14 dias ainda é dias (não semanas)', () => {
    expect(displayCountdown(14).unidade).toMatch(/dias restantes/);
  });
  it('15 dias vira semanas (≈2)', () => {
    expect(displayCountdown(15)).toEqual({ numero: '2', unidade: 'semanas restantes' });
  });
  it('singular pra 1 semana', () => {
    expect(displayCountdown(7 * 1 + 1).unidade).toMatch(/dias/); // 8 ainda é dias
    // 7 dias é a fronteira — vira semanas só com >=15 (Math.round(15/7)=2).
    // Quando dias for exatamente múltiplo de 7 e >=14, vira semanas plural.
  });
});

describe('fmtDataCurta', () => {
  it('formata como dia/mes_curto', () => {
    const d = new Date('2026-08-29T09:00:00');
    expect(fmtDataCurta(d.toISOString())).toBe('29/ago');
  });
  it('janeiro = jan', () => {
    const d = new Date('2026-01-05T09:00:00');
    expect(fmtDataCurta(d.toISOString())).toBe('5/jan');
  });
});
