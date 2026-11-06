// Shared test helpers. Test-only — never imported by application code.
import { expect, it, vi } from 'vitest';

// ── Known-defect tests ───────────────────────────────────────────────────────
//
// A known-defect test documents a confirmed application bug that has NOT been
// fixed yet. It is declared as a structured specification, not as a body whose
// failure message is pattern-matched:
//
//   observe     runs the scenario and returns what happened. Any error → RED.
//   invariants  facts that hold BOTH while the defect exists AND after a correct
//               fix (the record exists, the row is accounted for, the scenario
//               really ran …). Checked FIRST, on every run, and never skippable
//               by a later failure. Failure → RED ("invariant failed").
//   correct     asserts the CORRECT behaviour. While the defect exists it must
//               fail with an assertion error. If it passes → RED ("no longer
//               reproduces": convert to a normal regression test). Any
//               non-assertion error → RED (re-thrown).
//   symptom     projects the observation onto the documented wrong behaviour.
//   documented  the EXACT current wrong value of `symptom(o)`, compared with
//               strict deep equality. Anything else → RED ("changed symptom").
//
// So under `npm test` a known-defect test is green only when the scenario ran
// as documented, every invariant holds, the correct behaviour is absent, AND the
// observed wrong behaviour is exactly the documented one — not merely "some
// assertion failed with a similar message".
//
// Defect mode (`npm run test:defects`) runs observe → invariants → correct as an
// ordinary test, printing the raw assertion failure as evidence.

export interface DefectSpec<O> {
  observe: () => O | Promise<O>;
  invariants?: (o: O) => void;
  correct: (o: O) => void;
  symptom: (o: O) => unknown;
  documented: unknown;
}

const KNOWN_DEFECT_PREFIX = '[known defect]';

function defectMode(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const mode = (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE;
  return mode === 'known-defects' || env.SHOW_KNOWN_DEFECTS === '1';
}

const isAssertion = (e: unknown): e is Error => e instanceof Error && e.name === 'AssertionError';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Normal-mode evaluation. Resolves only if the defect reproduces exactly as documented. */
export async function evaluateKnownDefect<O>(spec: DefectSpec<O>): Promise<void> {
  const o = await spec.observe();

  if (spec.invariants) {
    try {
      spec.invariants(o);
    } catch (e) {
      throw new Error(`Known-defect invariant failed — this is not the documented scenario: ${msg(e)}`);
    }
  }

  let correctError: unknown = null;
  try {
    spec.correct(o);
  } catch (e) {
    correctError = e;
  }
  if (correctError === null) {
    throw new Error(
      'Known defect no longer reproduces — the correct behaviour now holds. ' +
        'If this was fixed intentionally, convert this test into a normal regression test.',
    );
  }
  if (!isAssertion(correctError)) throw correctError;

  const actual = spec.symptom(o);
  try {
    expect(actual).toStrictEqual(spec.documented);
  } catch (e) {
    throw new Error(`Known defect changed symptom — the behaviour is wrong in an undocumented way. ${msg(e)}`);
  }
}

/** Defect-mode evaluation: invariants then the correct-behaviour assertion, raw. */
async function showDefect<O>(spec: DefectSpec<O>): Promise<void> {
  const o = await spec.observe();
  spec.invariants?.(o);
  spec.correct(o);
}

interface KnownDefect {
  <O>(name: string, spec: DefectSpec<O>, timeout?: number): void;
  each<A extends unknown[]>(
    cases: readonly A[],
  ): <O>(name: string, make: (...args: A) => DefectSpec<O>, timeout?: number) => void;
}

export const knownDefect: KnownDefect = Object.assign(
  <O>(name: string, spec: DefectSpec<O>, timeout?: number) => {
    const title = `${KNOWN_DEFECT_PREFIX} ${name}`;
    it(title, async () => { await (defectMode() ? showDefect(spec) : evaluateKnownDefect(spec)); }, timeout);
  },
  {
    each<A extends unknown[]>(cases: readonly A[]) {
      return <O>(name: string, make: (...args: A) => DefectSpec<O>, timeout?: number) => {
        const title = `${KNOWN_DEFECT_PREFIX} ${name}`;
        it.each(cases as unknown as A[])(title, async (...args) => {
          const spec = make(...(args as unknown as A));
          await (defectMode() ? showDefect(spec) : evaluateKnownDefect(spec));
        }, timeout);
      };
    },
  },
);

// ── Clock & files ────────────────────────────────────────────────────────────

/**
 * Freeze "now" at a LOCAL wall-clock time (the test process runs in GMT+4, see
 * vitest.config.ts). Only Date is faked so promises / React scheduling are unaffected.
 */
export function freezeLocalTime(y: number, m: number, d: number, hh = 12, mm = 0): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(y, m - 1, d, hh, mm));
}

/** A File-like CSV upload for the RCSA importers (they only call `file.text()`). */
export function csvFile(text: string, name = 'import.csv'): File {
  return new File([text], name, { type: 'text/csv' });
}
