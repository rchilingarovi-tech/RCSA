// Known-defect specifications for the RCSA CSV importer (io/import.ts) and the
// Risk export → import round trip. Test-only. Shared by:
//   • src/io/import.test.ts      — registers them as known-defect tests
//   • src/test/helpers.test.ts   — negative self-tests that feed the SAME specs
//                                  wrong observations and prove they are rejected
import { expect, vi } from 'vitest';
import type { Asset, Risk, Treatment } from '../../data/models';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile, type ImportResult } from '../../io/import';
import { exportRisksCsv, exportTreatmentsCsv } from '../../csv/export';
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

/** Capture the CSV text an exporter would download (no file is written). */
async function captureExport(run: () => void): Promise<string> {
  let blob: Blob | null = null;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b as Blob; return 'blob:test'; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try {
    run();
  } finally {
    create.mockRestore();
    click.mockRestore();
  }
  if (!blob) throw new Error('exporter did not produce a file');
  return (blob as Blob).text();
}

/** Capture the CSV text the Risk exporter would download (no file is written). */
export function captureRiskExport(risks: Risk[], assets: Asset[]): Promise<string> {
  return captureExport(() => exportRisksCsv(risks, assets, []));
}

/** Capture the CSV text the Treatment exporter would download (no file is written). */
export function captureTreatmentExport(treatments: Treatment[]): Promise<string> {
  return captureExport(() => exportTreatmentsCsv(treatments));
}

/**
 * Blank every cell under `header` in an exporter-produced CSV (every field
 * quoted, "" escapes, LF records, optional BOM) and re-quote every field the way
 * the exporter does. Used because CSV import is create-only (ID integrity S2):
 * an export can only be imported as NEW records once its ID column is cleared.
 * Throws if the text is not in the exporter's fully-quoted shape.
 */
export function withIdColumnCleared(csv: string, header: string): string {
  const bom = csv.startsWith('﻿') ? '﻿' : '';
  const text = bom ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '"') throw new Error(`withIdColumnCleared: unquoted field at offset ${i}`);
    let value = '';
    i++;
    for (;;) {
      if (i >= text.length) throw new Error('withIdColumnCleared: unclosed quote');
      if (text[i] === '"') {
        if (text[i + 1] === '"') { value += '"'; i += 2; continue; }
        i++;
        break;
      }
      value += text[i++];
    }
    row.push(value);
    if (text[i] === ',') { i++; continue; }
    rows.push(row);
    row = [];
    if (text[i] === '\n') i++;
    else if (i < text.length) throw new Error(`withIdColumnCleared: unexpected character at offset ${i}`);
  }
  const col = rows[0]?.indexOf(header) ?? -1;
  if (col === -1) throw new Error(`withIdColumnCleared: no "${header}" column`);
  rows.slice(1).forEach((r) => { r[col] = ''; });
  return bom + rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n');
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
// Since ID integrity S2, CSV import is CREATE-ONLY: an export can no longer be
// re-imported as an update. D5 is therefore observed on the remaining path —
// the export with its ID column cleared, imported as a NEW record next to the
// original. The defect lives in the export/import transformation and is NOT
// fixed by removing the update path.

export const ROUND_TRIP_ASSETS = [asset('AST-001')];

/** The copied risk is ONE clean create with the next allocated ID. Holds before AND after a fix. */
function expectCleanSingleCreate(r: ImportResult<Risk>, id: string, assetIds: string[]): void {
  expect(r.errors, 'no import errors').toEqual([]);
  expect(r.rows, 'exactly one imported row').toHaveLength(1);
  expect(r.rows[0].id, 'the row is a NEW risk with the next allocated ID').toBe(id);
  expect(r.rows[0].assetIds, 'linked to the same assets as the original').toEqual(assetIds);
  expect({ updated: r.updated, created: r.created, skipped: r.skipped }, 'recognised as a create').toEqual({ updated: 0, created: 1, skipped: 0 });
}

/** Scores only — independent of the generated record ID (identity is asserted in the invariant). */
const scoreFields = (x: Risk) => ({
  impact: x.impact, likelihood: x.likelihood,
  resImpact: x.resImpact ?? null, resLikelihood: x.resLikelihood ?? null,
});

const copiedRiskExport = async (original: Risk) =>
  csvFile(withIdColumnCleared(await captureRiskExport([original], ROUND_TRIP_ASSETS), 'Risk ID'));

// Defect: the export writes only computed "Inherent Score"/"Residual Score"
// columns, not Impact / Likelihood / Residual Impact / Residual Likelihood, so the
// import resets them to 1 / 1 / not assessed.
export function roundTripScoresDefect(): DefectSpec<ImportResult<Risk>> {
  const original = risk('RSK-001', { impact: 5, likelihood: 4, resImpact: 3, resLikelihood: 2 });
  return {
    observe: async () => parseRisksFile(await copiedRiskExport(original), [original], ROUND_TRIP_ASSETS),
    invariants: (r) => expectCleanSingleCreate(r, 'RSK-002', original.assetIds),
    correct: (r) => expect(scoreFields(r.rows[0])).toEqual(scoreFields(original)),
    symptom: (r) => r.rows.map(scoreFields),
    documented: [{ impact: 1, likelihood: 1, resImpact: null, resLikelihood: null }],
  };
}

// Defect: the exporter prefixes = + - @ cells with an apostrophe; lib/tableIo.ts
// strips it on import (`unarmor`), io/import.ts does not.
export function roundTripApostropheDefect(): DefectSpec<ImportResult<Risk>> {
  const original = risk('RSK-001', { threat: '-Legacy VPN exposure' });
  return {
    observe: async () => parseRisksFile(await copiedRiskExport(original), [original], ROUND_TRIP_ASSETS),
    invariants: (r) => expectCleanSingleCreate(r, 'RSK-002', original.assetIds),
    correct: (r) => expect(r.rows[0].threat).toBe('-Legacy VPN exposure'),
    symptom: (r) => r.rows.map((x) => x.threat),
    documented: ["'-Legacy VPN exposure"],
  };
}

// ── D9: treatment export → import ("Overdue") ────────────────────────────────
// Defect: the treatment export writes the COMPUTED status (treatmentStatus →
// "Overdue" when past due), which is not an importable status, so the stored
// status is lost and the row is rejected. Observed on the create-only path
// (ID column cleared). Unresolved; pinned by decision D5-2.

export const D9_RISKS = [risk('RSK-001')];

export function treatmentOverdueRoundTripDefect(): DefectSpec<ImportResult<Treatment>> {
  const original: Treatment = {
    id: 'TRT-001', riskIds: ['RSK-001'], title: 'Patch VPN', description: '', owner: 'SecOps',
    dueDate: '2020-01-31', status: 'In Progress', evidence: [], comments: [], submittedAt: '2025-01-01',
  };
  return {
    observe: async () =>
      parseTreatmentsFile(
        csvFile(withIdColumnCleared(await captureTreatmentExport([original]), 'Treatment ID')),
        [original],
        D9_RISKS,
      ),
    invariants: (r) => expectRowAccountedFor(r),
    correct: (r) => {
      expect(r.errors).toEqual([]);
      expect(r.rows.map((t) => [t.id, t.status])).toEqual([['TRT-002', 'In Progress']]);
    },
    symptom: (r) => ({ rows: r.rows.map((t) => t.status), errors: r.errors, skipped: r.skipped }),
    // Exactly today's wrong behaviour: the exported "Overdue" is rejected, nothing is importable.
    documented: { rows: [], errors: [{ row: 2, field: 'Status', message: 'must be: Open, In Progress, Completed' }], skipped: 1 },
  };
}
