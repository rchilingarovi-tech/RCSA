// Characterization tests for the RCSA domain rules (domain/scoring.ts).
// These pin CURRENT behaviour so later changes can prove the Risk Catalogue /
// Treatment Catalogue logic stays identical. They do not change any rule.
import { describe, expect, it } from 'vitest';
import type { Asset, CIA, Risk, Score5, Treatment } from '../data/models';
import {
  assetValue,
  criticality,
  genId,
  hasResidual,
  inherentScore,
  isOverdue,
  localIso,
  residualScore,
  riskLevel,
  riskOverdue,
  riskStatus,
  rollupStatus,
  statusBadgeClass,
  today,
  todayPlus,
  treatmentsForRisk,
  treatmentStatus,
} from './scoring';
import { freezeLocalTime } from '../test/helpers';

const cia = (c: CIA, i: CIA, a: CIA): Pick<Asset, 'c' | 'i' | 'a'> => ({ c, i, a });

function risk(over: Partial<Risk> = {}): Risk {
  return {
    id: 'RSK-001', assetIds: ['AST-001'], threat: 'Malware infection', customThreat: false,
    vuln: '', owner: '', impact: 3, likelihood: 3, assessment: 'Mitigate', controls: [],
    acceptanceExpiry: '', evidence: [], comments: [], submittedAt: '2026-01-01', ...over,
  };
}

function trt(over: Partial<Treatment> = {}): Treatment {
  return {
    id: 'TRT-001', riskIds: ['RSK-001'], title: 't', description: '', owner: '',
    dueDate: '', status: 'Open', evidence: [], comments: [], submittedAt: '2026-01-01', ...over,
  };
}

// ── Asset value & criticality ────────────────────────────────────────────────
describe('assetValue (C × I × A)', () => {
  it('multiplies the three CIA ratings', () => {
    expect(assetValue(cia(1, 1, 1))).toBe(1);
    expect(assetValue(cia(2, 3, 1))).toBe(6);
    expect(assetValue(cia(3, 3, 2))).toBe(18);
    expect(assetValue(cia(3, 3, 3))).toBe(27);
  });
});

describe('criticality(value)', () => {
  it.each([
    [1, 'Low'], [6, 'Low'],
    [7, 'Medium'], [19, 'Medium'],
    [20, 'High'], [27, 'High'],
  ])('value %i → %s (thresholds ≤6 Low, ≤19 Medium, else High)', (v, label) => {
    expect(criticality(v)[0]).toBe(label);
  });

  it('returns the badge classes used by the UI', () => {
    expect(criticality(1)).toEqual(['Low', 'bg-green-100 text-green-800']);
    expect(criticality(12)).toEqual(['Medium', 'bg-yellow-100 text-yellow-800']);
    expect(criticality(27)).toEqual(['High', 'bg-red-100 text-red-800']);
  });

});

// Every one of the 27 possible C·I·A inputs, with its expected value and
// criticality written out literally (not recomputed), so a wrong mapping for
// any single input is caught. Consequence of the thresholds: CIA products are
// {1,2,3,4,6,8,9,12,18,27}, so only 3·3·3 is High.
const CIA_TABLE: [CIA, CIA, CIA, number, 'Low' | 'Medium' | 'High'][] = [
  [1, 1, 1, 1, 'Low'], [1, 1, 2, 2, 'Low'], [1, 1, 3, 3, 'Low'],
  [1, 2, 1, 2, 'Low'], [1, 2, 2, 4, 'Low'], [1, 2, 3, 6, 'Low'],
  [1, 3, 1, 3, 'Low'], [1, 3, 2, 6, 'Low'], [1, 3, 3, 9, 'Medium'],
  [2, 1, 1, 2, 'Low'], [2, 1, 2, 4, 'Low'], [2, 1, 3, 6, 'Low'],
  [2, 2, 1, 4, 'Low'], [2, 2, 2, 8, 'Medium'], [2, 2, 3, 12, 'Medium'],
  [2, 3, 1, 6, 'Low'], [2, 3, 2, 12, 'Medium'], [2, 3, 3, 18, 'Medium'],
  [3, 1, 1, 3, 'Low'], [3, 1, 2, 6, 'Low'], [3, 1, 3, 9, 'Medium'],
  [3, 2, 1, 6, 'Low'], [3, 2, 2, 12, 'Medium'], [3, 2, 3, 18, 'Medium'],
  [3, 3, 1, 9, 'Medium'], [3, 3, 2, 18, 'Medium'], [3, 3, 3, 27, 'High'],
];

describe('asset value → criticality, every C·I·A input', () => {
  it('the table covers all 27 combinations exactly once', () => {
    expect(new Set(CIA_TABLE.map(([c, i, a]) => `${c}${i}${a}`)).size).toBe(27);
  });

  it.each(CIA_TABLE)('C=%i I=%i A=%i → value %i, %s', (c, i, a, value, label) => {
    expect(assetValue(cia(c, i, a))).toBe(value);
    expect(criticality(assetValue(cia(c, i, a)))[0]).toBe(label);
  });
});

// ── Inherent & residual risk scoring ─────────────────────────────────────────
describe('riskLevel(score)', () => {
  it.each([
    [1, 'Low'], [4, 'Low'],
    [5, 'Medium'], [9, 'Medium'],
    [10, 'High'], [14, 'High'],
    [15, 'Critical'], [25, 'Critical'],
  ])('score %i → %s (thresholds ≤4, ≤9, ≤14, else Critical)', (s, label) => {
    expect(riskLevel(s)[0]).toBe(label);
  });

  it('returns the badge classes used by the UI', () => {
    expect(riskLevel(12)).toEqual(['High', 'bg-orange-100 text-orange-800']);
    expect(riskLevel(20)).toEqual(['Critical', 'bg-red-100 text-red-800']);
  });
});

describe('inherentScore', () => {
  it('is impact × likelihood', () => {
    expect(inherentScore(risk({ impact: 5, likelihood: 3 }))).toBe(15);
    expect(inherentScore(risk({ impact: 1, likelihood: 1 }))).toBe(1);
    expect(inherentScore(risk({ impact: 5, likelihood: 5 }))).toBe(25);
  });

});

// The full 5×5 matrix, written out literally: rows = impact 1..5, columns =
// likelihood 1..5. Each cell is checked individually for both inherent and
// residual scoring (the same matrix applies to both).
const L = 'Low', M = 'Medium', H = 'High', C = 'Critical';
const LEVEL_MATRIX: string[][] = [
  /* impact 1 */ [L, L, L, L, M],
  /* impact 2 */ [L, L, M, M, H],
  /* impact 3 */ [L, M, M, H, C],
  /* impact 4 */ [L, M, H, C, C],
  /* impact 5 */ [M, H, C, C, C],
];
const SCORE_MATRIX: number[][] = [
  [1, 2, 3, 4, 5],
  [2, 4, 6, 8, 10],
  [3, 6, 9, 12, 15],
  [4, 8, 12, 16, 20],
  [5, 10, 15, 20, 25],
];
const MATRIX_CASES = LEVEL_MATRIX.flatMap((row, ii) =>
  row.map((level, li) => [ii + 1, li + 1, SCORE_MATRIX[ii][li], level] as [number, number, number, string]),
);

describe('inherent & residual scoring, every impact × likelihood cell', () => {
  it('covers all 25 cells', () => {
    expect(MATRIX_CASES).toHaveLength(25);
  });

  it.each(MATRIX_CASES)('impact %i × likelihood %i → score %i, %s', (i, l, score, level) => {
    const inh = risk({ impact: i as Score5, likelihood: l as Score5 });
    expect(inherentScore(inh)).toBe(score);
    expect(riskLevel(inherentScore(inh))[0]).toBe(level);

    const res = risk({ resImpact: i as Score5, resLikelihood: l as Score5 });
    expect(residualScore(res)).toBe(score);
    expect(riskLevel(residualScore(res) as number)[0]).toBe(level);
  });
});

describe('residual scoring (optional)', () => {
  it('is assessed only when BOTH residual impact and likelihood are set', () => {
    expect(hasResidual({ resImpact: 2, resLikelihood: 3 })).toBe(true);
    expect(hasResidual({ resImpact: 2 })).toBe(false);
    expect(hasResidual({ resLikelihood: 3 })).toBe(false);
    expect(hasResidual({})).toBe(false);
  });

  it('residualScore is resImpact × resLikelihood, or null when not assessed', () => {
    expect(residualScore(risk({ resImpact: 4, resLikelihood: 2 }))).toBe(8);
    expect(residualScore(risk({ resImpact: 4 }))).toBeNull();
    expect(residualScore(risk())).toBeNull();
  });

  it('residual is independent of the inherent score', () => {
    const r = risk({ impact: 5, likelihood: 5, resImpact: 1, resLikelihood: 1 });
    expect(inherentScore(r)).toBe(25);
    expect(residualScore(r)).toBe(1);
  });
});

// ── Local dates (GMT+4 rule) ─────────────────────────────────────────────────
describe('local date helpers', () => {
  it('today() uses the LOCAL date, not UTC, in the early-morning window', () => {
    // 01:30 on 5 Nov in GMT+4 is still 4 Nov in UTC.
    freezeLocalTime(2026, 11, 5, 1, 30);
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-04');
    expect(today()).toBe('2026-11-05');
  });

  it('localIso pads month and day', () => {
    expect(localIso(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('todayPlus crosses month and year boundaries', () => {
    freezeLocalTime(2026, 12, 30);
    expect(todayPlus(0)).toBe('2026-12-30');
    expect(todayPlus(2)).toBe('2027-01-01');
    expect(todayPlus(-30)).toBe('2026-11-30');
  });
});

// ── Treatment status & overdue ───────────────────────────────────────────────
describe('isOverdue(treatment)', () => {
  it('is overdue only when due date has passed and status is not Completed', () => {
    freezeLocalTime(2026, 11, 5);
    expect(isOverdue(trt({ dueDate: '2026-11-04', status: 'Open' }))).toBe(true);
    expect(isOverdue(trt({ dueDate: '2026-11-04', status: 'In Progress' }))).toBe(true);
    expect(isOverdue(trt({ dueDate: '2026-11-04', status: 'Completed' }))).toBe(false);
  });

  it('a treatment due TODAY is not overdue', () => {
    freezeLocalTime(2026, 11, 5);
    expect(isOverdue(trt({ dueDate: '2026-11-05' }))).toBe(false);
  });

  it('a treatment with no due date is never overdue', () => {
    freezeLocalTime(2026, 11, 5);
    expect(isOverdue(trt({ dueDate: '' }))).toBe(false);
  });

  it('flips to overdue at local midnight, not at UTC midnight', () => {
    // 00:30 local on 6 Nov = 20:30 UTC on 5 Nov: due 5 Nov is already overdue locally.
    freezeLocalTime(2026, 11, 6, 0, 30);
    expect(isOverdue(trt({ dueDate: '2026-11-05' }))).toBe(true);
  });
});

describe('treatmentStatus (effective status)', () => {
  it('Overdue overrides the stored status', () => {
    freezeLocalTime(2026, 11, 5);
    expect(treatmentStatus(trt({ dueDate: '2026-01-01', status: 'In Progress' }))).toBe('Overdue');
  });

  it('otherwise returns the stored status', () => {
    freezeLocalTime(2026, 11, 5);
    expect(treatmentStatus(trt({ dueDate: '2027-01-01', status: 'Open' }))).toBe('Open');
    expect(treatmentStatus(trt({ dueDate: '2026-01-01', status: 'Completed' }))).toBe('Completed');
  });
});

describe('rollupStatus (risk status from its treatments)', () => {
  it('no treatments → No Plan', () => {
    expect(rollupStatus([])).toBe('No Plan');
  });

  it('any overdue treatment → Overdue, even if others are Completed', () => {
    freezeLocalTime(2026, 11, 5);
    expect(rollupStatus([
      trt({ status: 'Completed' }),
      trt({ id: 'TRT-002', dueDate: '2026-10-01', status: 'Open' }),
    ])).toBe('Overdue');
  });

  it('all treatments Completed → Completed', () => {
    expect(rollupStatus([trt({ status: 'Completed' }), trt({ id: 'TRT-002', status: 'Completed' })])).toBe('Completed');
  });

  it('a mix of Open / In Progress / Completed (none overdue) → In Progress', () => {
    freezeLocalTime(2026, 11, 5);
    expect(rollupStatus([trt({ status: 'Completed' }), trt({ id: 'TRT-002', status: 'Open', dueDate: '2027-01-01' })])).toBe('In Progress');
  });

  it('only Open treatments also roll up to In Progress (rollup never yields "Open")', () => {
    expect(rollupStatus([trt({ status: 'Open' })])).toBe('In Progress');
  });
});

describe('risk ↔ treatment helpers', () => {
  const treatments = [
    trt({ id: 'TRT-001', riskIds: ['RSK-001'], dueDate: '2026-01-01' }),
    trt({ id: 'TRT-002', riskIds: ['RSK-001', 'RSK-002'], status: 'Completed' }),
    trt({ id: 'TRT-003', riskIds: ['RSK-003'] }),
  ];

  it('treatmentsForRisk finds shared treatments too', () => {
    expect(treatmentsForRisk(treatments, 'RSK-001').map((t) => t.id)).toEqual(['TRT-001', 'TRT-002']);
    expect(treatmentsForRisk(treatments, 'RSK-002').map((t) => t.id)).toEqual(['TRT-002']);
    expect(treatmentsForRisk(treatments, 'RSK-404')).toEqual([]);
  });

  it('riskStatus / riskOverdue roll up per risk', () => {
    freezeLocalTime(2026, 11, 5);
    expect(riskStatus(risk({ id: 'RSK-001' }), treatments)).toBe('Overdue');
    expect(riskOverdue(risk({ id: 'RSK-001' }), treatments)).toBe(true);
    expect(riskStatus(risk({ id: 'RSK-002' }), treatments)).toBe('Completed');
    expect(riskOverdue(risk({ id: 'RSK-002' }), treatments)).toBe(false);
    expect(riskStatus(risk({ id: 'RSK-404' }), treatments)).toBe('No Plan');
  });

  it('statusBadgeClass maps each status', () => {
    expect(statusBadgeClass('Overdue')).toBe('bg-red-100 text-red-800');
    expect(statusBadgeClass('Completed')).toBe('bg-green-100 text-green-800');
    expect(statusBadgeClass('In Progress')).toBe('bg-blue-100 text-blue-800');
    expect(statusBadgeClass('No Plan')).toBe('bg-gray-100 text-gray-700');
  });
});

describe('genId (shared safe allocator since ID-integrity S1)', () => {
  const recs = (...ids: string[]) => ids.map((id) => ({ id }));
  it('allocates after the HIGHEST existing number, zero-padded to 3 (was: array length + 1)', () => {
    expect(genId('RSK', [])).toBe('RSK-001');
    expect(genId('RSK', recs('RSK-001', 'RSK-009'))).toBe('RSK-010');
    // A gap left by a delete is NOT refilled — the old length-based rule
    // returned AST-002 here, i.e. an id still in use (defect D1).
    expect(genId('AST', recs('AST-001', 'AST-003'))).toBe('AST-004');
  });
  // Full allocator rules: src/data/ids.test.ts. Collision regressions:
  // src/test/regressions/id-collision.test.ts.
});
