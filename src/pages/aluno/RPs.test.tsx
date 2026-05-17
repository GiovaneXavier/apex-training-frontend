import { describe, expect, it } from 'vitest';

import { fmtPace } from './RPs';

// PR #19 — formatação de pace (segPorKm → MM:SS).
describe('fmtPace — formatação de pace endurance', () => {
  it('5:00 /km (300 s/km)', () => {
    expect(fmtPace(300)).toBe('5:00');
  });

  it('4:48 /km (288 s/km arredondado)', () => {
    expect(fmtPace(287.5)).toBe('4:48');
  });

  it('singular digit no segundo é zero-padded', () => {
    expect(fmtPace(305)).toBe('5:05');
  });

  it('pace alto (caminhada 10:00 /km)', () => {
    expect(fmtPace(600)).toBe('10:00');
  });

  it('pace altíssimo (>1 hora — edge case)', () => {
    expect(fmtPace(3725)).toBe('62:05'); // 1h2min5s sem cap
  });

  it('valores inválidos → "—"', () => {
    expect(fmtPace(0)).toBe('—');
    expect(fmtPace(-10)).toBe('—');
    expect(fmtPace(NaN)).toBe('—');
    expect(fmtPace(Infinity)).toBe('—');
  });
});
