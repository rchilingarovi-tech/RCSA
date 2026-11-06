// Characterization tests for Department KPI scoring (modules/kpis/types.ts).
import { describe, expect, it } from 'vitest';
import { attainment, parseHistory, rag, ragLabel, type Direction } from './types';
import { knownDefect } from '../../test/helpers';

const k = (current: number, target: number, direction: Direction) => ({ current, target, direction });
const HI: Direction = 'Higher is better';
const LO: Direction = 'Lower is better';

describe('rag — Higher is better', () => {
  it('at or above target → On Track (low)', () => {
    expect(rag(k(95, 95, HI))).toBe('low');
    expect(rag(k(100, 95, HI))).toBe('low');
  });
  it('within 90% of target → At Risk (med)', () => {
    expect(rag(k(90, 100, HI))).toBe('med');
    expect(rag(k(99.9, 100, HI))).toBe('med');
  });
  it('below 90% of target → Off Track (crit)', () => {
    expect(rag(k(89.9, 100, HI))).toBe('crit');
    expect(rag(k(0, 100, HI))).toBe('crit');
  });
});

describe('rag — Lower is better', () => {
  it('at or below target → On Track (low)', () => {
    expect(rag(k(5, 5, LO))).toBe('low');
    expect(rag(k(0, 5, LO))).toBe('low');
  });
  it('up to 125% of target → At Risk (med)', () => {
    expect(rag(k(5.1, 5, LO))).toBe('med');
    expect(rag(k(6.25, 5, LO))).toBe('med');
  });
  it('above 125% of target → Off Track (crit)', () => {
    expect(rag(k(6.26, 5, LO))).toBe('crit');
  });
  it('a target of 0 is only On Track at exactly 0', () => {
    expect(rag(k(0, 0, LO))).toBe('low');
    expect(rag(k(1, 0, LO))).toBe('crit');
  });
});

describe('ragLabel', () => {
  it('maps tokens to labels', () => {
    expect(ragLabel('low')).toBe('On Track');
    expect(ragLabel('med')).toBe('At Risk');
    expect(ragLabel('crit')).toBe('Off Track');
  });
});

describe('attainment (0–100 %, direction-aware)', () => {
  it('Higher is better: current ÷ target, capped at 100', () => {
    expect(attainment(k(45, 90, HI))).toBe(50);
    expect(attainment(k(120, 100, HI))).toBe(100);
    expect(attainment(k(0, 100, HI))).toBe(0);
  });
  it('Lower is better: 100 at/below target, otherwise target ÷ current', () => {
    expect(attainment(k(3, 5, LO))).toBe(100);
    expect(attainment(k(10, 5, LO))).toBe(50);
    expect(attainment(k(0, 5, LO))).toBe(100);
  });
  it('target 0: 100 only when current is also 0', () => {
    expect(attainment(k(0, 0, HI))).toBe(100);
    expect(attainment(k(3, 0, HI))).toBe(0);
    expect(attainment(k(3, 0, LO))).toBe(0);
  });
  it('rounds to a whole percent and never goes negative', () => {
    expect(attainment(k(1, 3, HI))).toBe(33);
    expect(attainment(k(-5, 10, HI))).toBe(0);
  });
});

describe('parseHistory', () => {
  it('parses comma-separated numbers, oldest → newest', () => {
    expect(parseHistory('80, 82.5,90')).toEqual([80, 82.5, 90]);
  });
  it('drops non-numeric entries', () => {
    expect(parseHistory('80, n/a, 90')).toEqual([80, 90]);
  });
  // Known defect: Number('') === 0, so blank entries become 0 data points.
  // Visible impact: an empty slot inside a longer history ("80,,90") draws a
  // fabricated 0 on the KPI sparkline, contrary to the honest-data rule. A fully
  // blank history parses to [0], which the Sparkline still shows as
  // "no history" (it needs ≥2 points) — the defect there is in the parsed data.
  knownDefect('a blank history parses to no data points', {
    observe: () => parseHistory(''),
    correct: (h) => expect(h).toEqual([]),
    symptom: (h) => h,
    documented: [0],
  });
  knownDefect('an empty slot between commas is not turned into a 0 data point', {
    observe: () => parseHistory('80,,90'),
    // The real points must survive regardless of the fix.
    invariants: (h) => { expect(h[0]).toBe(80); expect(h[h.length - 1]).toBe(90); },
    correct: (h) => expect(h).toEqual([80, 90]),
    symptom: (h) => h,
    documented: [80, 0, 90],
  });
});
