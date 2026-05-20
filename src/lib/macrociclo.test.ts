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
  // Gera ISO espelhando o que o backend produz: data civil + horário
  // hardcoded 12:00 UTC (= 09:00 BRT). Mantém o YYYY-MM-DD da ISO string
  // alinhado com o dia civil em fusos negativos comuns (UTC-3..UTC-5).
  function isoDoDia(offsetDias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDias);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T12:00:00.000Z`;
  }

  it('mesma data civil → 0 dias', () => {
    expect(diasAteIso(isoDoDia(0))).toBe(0);
  });
  it('próximo dia civil → 1 dia', () => {
    expect(diasAteIso(isoDoDia(1))).toBe(1);
  });

  // PR #39 — fix Gemini review #1 (timezone shift).
  // Antes: `new Date(iso).setHours(0)` resolvia pro dia LOCAL, podendo
  // shiftar 1 dia pra trás dependendo do TZ. Agora: extrai YYYY-MM-DD
  // direto da string → invariante por TZ.
  it('respeita YYYY-MM-DD da string mesmo com timestamp UTC distante (anti-TZ-shift)', () => {
    // String com horário 00:00 UTC. Em qualquer TZ negativo (UTC-N),
    // `new Date(iso)` resolveria pro dia ANTERIOR. Com isoParaDataLocal,
    // sempre lemos o YYYY-MM-DD = 2099-12-31 (data 100% determinística).
    const iso = '2099-12-31T00:00:00.000Z';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(2099, 11, 31);
    const esperado = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
    expect(diasAteIso(iso)).toBe(esperado);
  });

  it('aceita string sem T (só YYYY-MM-DD) sem quebrar', () => {
    // Defensivo: alguns backends podem mandar `2099-12-31` puro.
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(2099, 11, 31);
    const esperado = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
    expect(diasAteIso('2099-12-31')).toBe(esperado);
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
    expect(fmtDataCurta('2026-08-29T09:00:00.000Z')).toBe('29/ago');
  });
  it('janeiro = jan', () => {
    expect(fmtDataCurta('2026-01-05T09:00:00.000Z')).toBe('5/jan');
  });
  // PR #39 — fix Gemini review #2 (mesmo TZ shift). String à meia-noite
  // UTC deve renderizar o YYYY-MM-DD da string, não o dia local resolvido.
  it('respeita YYYY-MM-DD mesmo com timestamp 00:00 UTC (anti-TZ-shift)', () => {
    // Em qualquer TZ negativo, `new Date('2026-08-29T00:00:00Z')` aterrissa
    // no dia 28. Com isoParaDataLocal, sempre 29/ago.
    expect(fmtDataCurta('2026-08-29T00:00:00.000Z')).toBe('29/ago');
  });
});
