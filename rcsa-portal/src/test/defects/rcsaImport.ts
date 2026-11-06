// Known-defect specifications for the RCSA CSV importer (io/import.ts) and the
// Risk export → import round trip. Test-only. Shared by:
//   • src/io/import.test.ts      — registers them as known-defect tests
//   • src/test/helpers.test.ts   — negative self-tests that feed the SAME specs
//                                  wrong observations and prove they are rejected
import { expect, vi } from 'vitest';
import type { Asset, Risk } from '../../data/models';
import { parseAssetsFile, parseRisksFile, type ImportResult } from '../../io/import';
import { exportRisksCsv } from '../../csv/export';
import { csvFile, type DefectSpec } from '../helpers';

// ── Fixtures ─────────────────────────────────────────────────────────────────

export function asset(id: string, over: Partial<Asset> = {}): Asset {
  return {
    id, name: `Asset ${id}`, process: 'p', department: 'IT', busOwner: 'b', itOwner: 'i', applicantName: 'a',
    c: 1, i: 1, a: 1, dataClass: 'Internal', pci: 'No', criticalProcess: 'No', internet: 'No', thirdParty: 'No',
    cloud: 'No', status: 'Draft', reviewDate: '', evidence: [], notes: '', submittedAt: '2025-01-01', ...over,
  };
}

export function risk(id: string, over: Partial<Risk> = {}): Risk {
  return {
    id, assetIds: ['AST-001'], threat: 'DDoS', customThreat: false, vuln: '', owner: '', impact: 3, likelihood: 3,
    assessment: 'Mitigate', controls: [], acceptanceExpiry: '', evidence: [], comments: [], submittedAt: '2025-01-01', ...over,
  };
}

/** Capture the CSV text the Risk exporter would download (no file is written). */
export async function captureRiskExport(risks: Risk[], assets: Asset[]): Promise<string> {
  let blob: Blob | null = null;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b as Blob; return 'blob:test'; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    exportRisksCsv(risks, assets, []);
  } finally {
    create.mockRestore();
    click.mockRestore();
  }
  if (!blob) throw new Error('exporter did not produce a file');
  return (blob as Blob).text();
}

/** Every data row is either imported or reported — never silently discarded. */
function expectRowAccountedFor<T>(r: ImportResult<T>): void {
  expect(r.totalDataRows, 'the file has exactly one data row').toBe(1);
  expect(r.rows.length + r.skipped, 'the row is either imported or skipped').toBe(1);
  expect(r.rows.length === 1 || r.errors.length > 0, 'a skipped row must come with a diagnostic').toBe(true);
}

// ── Asset Yes/No flags ───────────────────────────────────────────────────────
// Defect: the Yes/No columns are parsed inside `rows.push(...)`, AFTER the
// "skip rows with errors" check, so an invalid value is imported as "No" and the
// error is never reported.

export const YES_NO_COLUMNS = [
  ['PCI', 'pci'], ['Critical Process', 'criticalProcess'], ['Internet Facing', 'internet'],
  ['Third Party', 'thirdParty'], ['Cloud', 'cloud'],
] as const;
export type YesNoColumn = (typeof YES_NO_COLUMNS)[number][0];
type YesNoProp = (typeof YES_NO_COLUMNS)[number][1];
const yesNoProp = (col: YesNoColumn): YesNoProp => YES_NO_COLUMNS.find(([c]) => c === col)![1];

export function invalidYesNoDefect(col: YesNoColumn): DefectSpec<ImportResult<Asset>> {
  const prop = yesNoProp(col);
  return {
    observe: () => parseAssetsFile(csvFile(`Name,${col}\nX,maybe\n`), []),
    invariants: (r) => expectRowAccountedFor(r),
    correct: (r) => {
      expect(r.errors).toEqual([{ row: 2, field: col, message: '"maybe" must be Yes or No' }]);
      expect(r.rows).toHaveLength(0);
      expect(r.skipped).toBe(1);
    },
    symptom: (r) => ({
      rows: r.rows.map((a) => ({ id: a.id, name: a.name, value: a[prop] })),
      errors: r.errors,
      skipped: r.skipped,
    }),
    // Exactly today's wrong behaviour: the row IS imported, with "No", and no error.
    documented: { rows: [{ id: 'AST-001', name: 'X', value: 'No' }], errors: [], skipped: 0 },
  };
}

// ── Risk scores ──────────────────────────────────────────────────────────────
// Defect: scores are parsed inside `rows.push(...)`, AFTER the error check. An
// out-of-range / non-numeric score is imported as 1 (residual: "not assessed")
// and no error is reported — e.g. "Impact = 6" lands as Impact 1.

export const INVALID_SCORES = [
  ['Impact', '6'], ['Likelihood', '0'], ['Residual Impact', 'x'], ['Residual Likelihood', '9'],
] as const;
export type ScoreColumn = (typeof INVALID_SCORES)[number][0];

const scoreView = (x: Risk) => ({
  id: x.id, impact: x.impact, likelihood: x.likelihood,
  resImpact: x.resImpact ?? null, resLikelihood: x.resLikelihood ?? null,
});

export const SCORE_ASSETS = [asset('AST-001'), asset('AST-002')];

export function invalidScoreDefect(col: ScoreColumn, val: string): DefectSpec<ImportResult<Risk>> {
  return {
    observe: () => parseRisksFile(csvFile(`Asset ID,Threat,${col}\nAST-001,DDoS,${val}\n`), [], SCORE_ASSETS),
    invariants: (r) => expectRowAccountedFor(r),
    correct: (r) => {
      expect(r.errors).toEqual([{ row: 2, field: col, message: `"${val}" must be 1–5` }]);
      expect(r.rows).toHaveLength(0);
      expect(r.skipped).toBe(1);
    },
    symptom: (r) => ({ rows: r.rows.map(scoreView), errors: r.errors, skipped: r.skipped }),
    // Exactly today's wrong behaviour: imported with the defaults (1 / 1 / not assessed), no error.
    documented: {
      rows: [{ id: 'RSK-001', impact: 1, likelihood: 1, resImpact: null, resLikelihood: null }],
      errors: [],
      skipped: 0,
    },
  };
}

// ── Risk export → import round trip ──────────────────────────────────────────
// The importer header promises it "round-trips with the CSV export".

export const ROUND_TRIP_ASSETS = [asset('AST-001')];

/** The re-import must be a clean, single update of the same risk. Holds before AND after a fix. */
function expectCleanSingleUpdate(r: ImportResult<Risk>, id: string): void {
  expect(r.errors, 'no import errors').toEqual([]);
  expect(r.rows, 'exactly one imported row').toHaveLength(1);
  expect(r.rows[0].id, 'the row is the exported risk').toBe(id);
  expect({ updated: r.updated, created: r.created, skipped: r.skipped }, 'recognised as an update').toEqual({ updated: 1, created: 0, skipped: 0 });
}

// Defect: the export writes only computed "Inherent Score"/"Residual Score"
// columns, not Impact / Likelihood / Residual Impact / Residual Likelihood, so the
// re-import resets them to 1 / 1 / not assessed.
export function roundTripScoresDefect(): DefectSpec<ImportResult<Risk>> {
  const original = risk('RSK-001', { impact: 5, likelihood: 4, resImpact: 3, resLikelihood: 2 });
  return {
    observe: async () => parseRisksFile(csvFile(await captureRiskExport([original], ROUND_TRIP_ASSETS)), [original], ROUND_TRIP_ASSETS),
    invariants: (r) => expectCleanSingleUpdate(r, original.id),
    correct: (r) => expect(scoreView(r.rows[0])).toEqual(scoreView(original)),
    symptom: (r) => r.rows.map(scoreView),
    documented: [{ id: 'RSK-001', impact: 1, likelihood: 1, resImpact: null, resLikelihood: null }],
  };
}

// Defect: the exporter prefixes = + - @ cells with an apostrophe; lib/tableIo.ts
// strips it on import (`unarmor`), io/import.ts does not.
export function roundTripApostropheDefect(): DefectSpec<ImportResult<Risk>> {
  const original = risk('RSK-001', { threat: '-Legacy VPN exposure' });
  return {
    observe: async () => parseRisksFile(csvFile(await captureRiskExport([original], ROUND_TRIP_ASSETS)), [original], ROUND_TRIP_ASSETS),
    invariants: (r) => expectCleanSingleUpdate(r, original.id),
    correct: (r) => expect(r.rows[0].threat).toBe('-Legacy VPN exposure'),
    symptom: (r) => r.rows.map((x) => x.threat),
    documented: ["'-Legacy VPN exposure"],
  };
}
