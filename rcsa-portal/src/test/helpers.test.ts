// Self-tests for the known-defect mechanism (src/test/helpers.ts).
//
// Part 1 proves the generic contract on small synthetic specs.
// Part 2 takes the REAL specs used by the suite (src/test/defects/rcsaImport.ts),
// keeps their invariants / correct / documented symptom unchanged, and replaces
// only `observe` with a fabricated outcome — reproducing each false-positive
// scenario from the second independent review and proving it is now REJECTED.
import { describe, expect, it } from 'vitest';
import type { Asset, Risk } from '../data/models';
import type { ImportResult } from '../io/import';
import { evaluateKnownDefect, type DefectSpec } from './helpers';
import {
  invalidScoreDefect, invalidYesNoDefect, risk, roundTripApostropheDefect, roundTripScoresDefect,
} from './defects/rcsaImport';

const result = <T>(over: Partial<ImportResult<T>>): ImportResult<T> => ({
  rows: [], created: 0, updated: 0, errors: [], skipped: 0, totalDataRows: 1, ...over,
});
const withObservation = <O>(spec: DefectSpec<O>, o: O): DefectSpec<O> => ({ ...spec, observe: () => o });

// ── Part 1: generic contract ─────────────────────────────────────────────────
describe('known-defect contract', () => {
  const base: DefectSpec<number> = {
    observe: () => 1,
    invariants: (n) => expect(n).toBeGreaterThan(0),
    correct: (n) => expect(n).toBe(2),
    symptom: (n) => n,
    documented: 1,
  };

  it('passes only when invariants hold, the correct assertion fails, and the symptom is exactly as documented', async () => {
    await expect(evaluateKnownDefect(base)).resolves.toBeUndefined();
  });

  it('REJECTS when the defect no longer reproduces (correct behaviour holds)', async () => {
    await expect(evaluateKnownDefect(withObservation(base, 2))).rejects.toThrow(/no longer reproduces/);
  });

  it('REJECTS a different wrong value (changed symptom), even though "correct" still fails', async () => {
    await expect(evaluateKnownDefect(withObservation(base, 3))).rejects.toThrow(/changed symptom/);
  });

  it('REJECTS when an invariant fails, even if the symptom would otherwise match', async () => {
    const spec = { ...base, invariants: () => expect('prerequisite').toBe('met') };
    await expect(evaluateKnownDefect(spec)).rejects.toThrow(/invariant failed/);
  });

  it('checks invariants BEFORE the correct assertion (an earlier failure cannot hide them)', async () => {
    const order: string[] = [];
    const spec: DefectSpec<number> = {
      ...base,
      invariants: () => { order.push('invariants'); },
      correct: () => { order.push('correct'); expect(1).toBe(2); },
      symptom: (n) => { order.push('symptom'); return n; },
    };
    await evaluateKnownDefect(spec);
    expect(order).toEqual(['invariants', 'correct', 'symptom']);
  });

  it('REJECTS (re-throws) a scenario crash in observe', async () => {
    const spec = { ...base, observe: () => { throw new TypeError('cannot read properties of undefined'); } };
    await expect(evaluateKnownDefect(spec)).rejects.toThrow(TypeError);
  });

  it('REJECTS (re-throws) a non-assertion error inside the correct check', async () => {
    const spec = { ...base, correct: () => { throw new TypeError('rows[0] is undefined'); } };
    await expect(evaluateKnownDefect(spec)).rejects.toThrow(TypeError);
  });

  it('compares the symptom with STRICT equality (undefined vs missing, extra keys)', async () => {
    const spec: DefectSpec<object> = {
      observe: () => ({ a: 1, b: undefined }),
      invariants: (o) => expect(o).toHaveProperty('a', 1),
      correct: () => expect(1).toBe(2),
      symptom: (o) => o,
      documented: { a: 1 }, // loose toEqual would accept this; strict comparison must not
    };
    await expect(evaluateKnownDefect(spec)).rejects.toThrow(/changed symptom/);
  });
});

// ── Part 2: the reviewer's three false-positive scenarios, on the real specs ─
describe('false-positive scenarios are rejected (real specs, fabricated observations)', () => {
  // Positive controls: the real specs with their REAL observations pass.
  it('control: the real round-trip and validation specs reproduce exactly as documented', async () => {
    await expect(evaluateKnownDefect(roundTripScoresDefect())).resolves.toBeUndefined();
    await expect(evaluateKnownDefect(roundTripApostropheDefect())).resolves.toBeUndefined();
    await expect(evaluateKnownDefect(invalidYesNoDefect('PCI'))).resolves.toBeUndefined();
    await expect(evaluateKnownDefect(invalidScoreDefect('Impact', '6'))).resolves.toBeUndefined();
  });

  // Scenario 1 — different incorrect risk scores.
  // Since ID integrity S2 the D5 round trip is a create-only copy: the observed
  // row is a NEW risk RSK-002 (created: 1); identity lives in the invariant and
  // scores are compared without IDs (design §9.2 / §9.3).
  it('scenario 1: a round trip that yields DIFFERENT wrong scores (3/1 instead of 1/1) is rejected', async () => {
    const wrong = result<Risk>({ rows: [risk('RSK-002', { impact: 3, likelihood: 1 })], created: 1 });
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), wrong))).rejects.toThrow(/changed symptom/);
  });

  it('scenario 1b: wrong scores with a residual value that is not the documented "not assessed" are rejected', async () => {
    const wrong = result<Risk>({ rows: [risk('RSK-002', { impact: 1, likelihood: 1, resImpact: 1, resLikelihood: 1 })], created: 1 });
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), wrong))).rejects.toThrow(/changed symptom/);
  });

  it('scenario 1c: an invalid "Impact = 6" imported as 2 (not the documented 1) is rejected', async () => {
    const wrong = result<Risk>({ rows: [risk('RSK-001', { impact: 2, likelihood: 1 })], created: 1 });
    await expect(evaluateKnownDefect(withObservation(invalidScoreDefect('Impact', '6'), wrong))).rejects.toThrow(/changed symptom/);
  });

  // Scenario 2 — the imported risk is missing entirely.
  it('scenario 2: a round trip where the imported risk is MISSING is rejected (invariant)', async () => {
    const missing = result<Risk>({ rows: [] });
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), missing))).rejects.toThrow(/invariant failed/);
    await expect(evaluateKnownDefect(withObservation(roundTripApostropheDefect(), missing))).rejects.toThrow(/invariant failed/);
  });

  it('scenario 2b: a round trip that imports a DIFFERENT risk, or updates instead of creating, is rejected', async () => {
    const otherRisk = result<Risk>({ rows: [risk('RSK-999', { impact: 1, likelihood: 1 })], created: 1 });
    const updatedInstead = result<Risk>({ rows: [risk('RSK-002', { impact: 1, likelihood: 1 })], updated: 1, created: 0 });
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), otherRisk))).rejects.toThrow(/invariant failed/);
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), updatedInstead))).rejects.toThrow(/invariant failed/);
  });

  // S2 (design §9.2, new 2c): identity and scores are asserted separately, so
  // CORRECT scores on the WRONG identity must not read as a fix.
  it('scenario 2c: preserved scores on the original ID (not a new record) are rejected (invariant)', async () => {
    const wrongIdentity = result<Risk>({ rows: [risk('RSK-001', { impact: 5, likelihood: 4, resImpact: 3, resLikelihood: 2 })], created: 1 });
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), wrongIdentity))).rejects.toThrow(/invariant failed/);
  });

  // Scenario 3 — an invalid row silently discarded, no diagnostics.
  it('scenario 3: an invalid asset row SILENTLY DISCARDED (no rows, no errors) is rejected (invariant)', async () => {
    const silent = result<Asset>({ rows: [], errors: [], skipped: 1 });
    await expect(evaluateKnownDefect(withObservation(invalidYesNoDefect('PCI'), silent))).rejects.toThrow(/invariant failed/);
  });

  it('scenario 3b: an invalid risk-score row silently discarded is rejected (invariant)', async () => {
    const silent = result<Risk>({ rows: [], errors: [], skipped: 1 });
    await expect(evaluateKnownDefect(withObservation(invalidScoreDefect('Impact', '6'), silent))).rejects.toThrow(/invariant failed/);
  });

  it('scenario 3c: a row neither imported nor counted as skipped is rejected (invariant)', async () => {
    const vanished = result<Asset>({ rows: [], errors: [], skipped: 0 });
    await expect(evaluateKnownDefect(withObservation(invalidYesNoDefect('Cloud'), vanished))).rejects.toThrow(/invariant failed/);
  });

  // And the fixed outcome turns each of them red, prompting conversion.
  it('the CORRECT outcome is reported as "no longer reproduces" for each real spec', async () => {
    const rejectedAsset = result<Asset>({ errors: [{ row: 2, field: 'PCI', message: '"maybe" must be Yes or No' }], skipped: 1 });
    const rejectedRisk = result<Risk>({ errors: [{ row: 2, field: 'Impact', message: '"6" must be 1–5' }], skipped: 1 });
    const preserved = result<Risk>({ rows: [risk('RSK-002', { impact: 5, likelihood: 4, resImpact: 3, resLikelihood: 2 })], created: 1 });
    const unarmoured = result<Risk>({ rows: [risk('RSK-002', { threat: '-Legacy VPN exposure' })], created: 1 });
    await expect(evaluateKnownDefect(withObservation(invalidYesNoDefect('PCI'), rejectedAsset))).rejects.toThrow(/no longer reproduces/);
    await expect(evaluateKnownDefect(withObservation(invalidScoreDefect('Impact', '6'), rejectedRisk))).rejects.toThrow(/no longer reproduces/);
    await expect(evaluateKnownDefect(withObservation(roundTripScoresDefect(), preserved))).rejects.toThrow(/no longer reproduces/);
    await expect(evaluateKnownDefect(withObservation(roundTripApostropheDefect(), unarmoured))).rejects.toThrow(/no longer reproduces/);
  });
});
