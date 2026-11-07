// ID integrity S2 — regression tests for create-only imports.
// Step 1 (preview level): create-only identity, strict CSV grammar,
// identity/reference columns, exact fail-closed references and the
// armor-before-trim order (design §3, §9.1 T-ID, T-Q, T-COL, T-REF,
// T-REF-ARMOR). "Blocked" = the preview has errors, so the UI cannot import
// (asserted for the UIs in import-commit-ui.test.tsx).
// Step 2 (persistence core, data/importCommit.ts; design §4.1–§4.3, §9.1 T-S,
// T-SE, T-L, T-P, T-W data part): see the sections at the end of this file.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { commitNewRecords, readForImport, type ImportParent } from '../../data/importCommit';
import type { Asset, Risk, Treatment } from '../../data/models';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile, type ImportResult } from '../../io/import';
import { exportRows, importCsvText, type ImportResult as TableResult, type IoSpec } from '../../lib/tableIo';
import { exportAssetsCsv } from '../../csv/export';
import { csvFile } from '../helpers';
import { asset, captureRiskExport, captureTreatmentExport, risk, withIdColumnCleared } from '../defects/rcsaImport';
import { accessIo } from '../../modules/access/io';
import { courseIo } from '../../modules/awareness/io';
import { meetingIo } from '../../modules/committee/io';
import { findingIo } from '../../modules/findings/io';
import { incidentIo } from '../../modules/incidents/io';
import { kpiIo } from '../../modules/kpis/io';
import { planIo } from '../../modules/plan/io';
import { policyIo } from '../../modules/policies/io';
import { vendorIo } from '../../modules/vendors/io';
import { vulnIo } from '../../modules/vulns/io';
import { accessRepo } from '../../modules/access/repo';
import { awarenessRepo } from '../../modules/awareness/repo';
import { committeeRepo } from '../../modules/committee/repo';
import { findingsRepo } from '../../modules/findings/repo';
import { incidentRepo } from '../../modules/incidents/repo';
import { kpiRepo } from '../../modules/kpis/repo';
import { planRepo } from '../../modules/plan/repo';
import { policyRepo } from '../../modules/policies/repo';
import { vendorRepo } from '../../modules/vendors/repo';
import { vulnRepo } from '../../modules/vulns/repo';

const CREATE_ONLY = /CSV import creates new records only, and IDs are assigned automatically/;

/** Capture what an exporter would download (no file is written). */
async function capture(run: () => void): Promise<string> {
  let blob: Blob | null = null;
  const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b as Blob; return 'blob:test'; });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  try { run(); } finally { create.mockRestore(); click.mockRestore(); }
  if (!blob) throw new Error('exporter did not produce a file');
  return (blob as Blob).text();
}

const blocked = (r: { rows: unknown[]; errors: unknown[] }) => {
  expect(r.errors.length, 'the preview has errors, so Import is disabled').toBeGreaterThan(0);
};
const fileError = (r: ImportResult<unknown> | TableResult<{ id: string }>) => {
  expect(r.rows).toEqual([]);
  expect(r.totalDataRows).toBe(0);
  expect(r.errors).toHaveLength(1);
  expect(r.errors[0].field).toBe('File');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpec = IoSpec<any>;
const STANDALONE: [string, AnySpec, { list(): { id: string }[] }][] = [
  ['Access Reviews', accessIo, accessRepo], ['Awareness', courseIo, awarenessRepo], ['Committee', meetingIo, committeeRepo],
  ['Findings', findingIo, findingsRepo], ['Incidents', incidentIo, incidentRepo], ['KPIs', kpiIo, kpiRepo],
  ['Yearly Plan', planIo, planRepo], ['Policies', policyIo, policyRepo], ['Vendors', vendorIo, vendorRepo],
  ['Vulnerabilities', vulnIo, vulnRepo],
];
const requiredHeader = (spec: AnySpec) => spec.cols.find((c) => c.required)!.header;
const idAliases = (spec: AnySpec) => { const c = spec.cols.find((x) => x.header === 'ID')!; return [c.header, ...(c.aliases ?? [])]; };

// ── T-ID: create-only identity on all 13 importers (B-1) ─────────────────────
describe('T-ID: any non-blank ID cell blocks the file (all 13 importers)', () => {
  it.each(STANDALONE)('%s: its real export is blocked — every row reports the create-only ID error', async (_n, spec, repo) => {
    const existing = repo.list();
    expect(existing.length).toBeGreaterThan(0);
    const csv = await capture(() => exportRows(spec, existing));
    const r = importCsvText(spec, csv, existing);
    expect(r.rows).toEqual([]);
    const idErrors = r.errors.filter((e) => e.field === 'ID');
    expect(idErrors).toHaveLength(existing.length);
    idErrors.forEach((e) => expect(e.message).toMatch(CREATE_ONLY));
  });

  it.each(STANDALONE)('%s: every ID alias column is checked; a blank ID column (template shape) imports', (_n, spec) => {
    const req = requiredHeader(spec);
    for (const alias of idAliases(spec)) {
      const r = importCsvText(spec, `${alias},${req}\nX-1,Value\n`, []);
      expect(r.rows, alias).toEqual([]);
      expect(r.errors.map((e) => e.field), alias).toEqual([alias]);
    }
    const ok = importCsvText(spec, `ID,${req}\n,Value\n`, []);
    expect(ok.errors).toEqual([]);
    expect(ok).toMatchObject({ created: 1, updated: 0 });
  });

  it('RCSA: the real asset, risk and treatment exports are blocked', async () => {
    const assets = [asset('AST-001')];
    const assetCsv = await capture(() => exportAssetsCsv(assets));
    const ra = await parseAssetsFile(csvFile(assetCsv), assets);
    expect(ra.rows).toEqual([]);
    expect(ra.errors.map((e) => e.field)).toEqual(['Asset ID']);

    const risks = [risk('RSK-001')];
    const rr = await parseRisksFile(csvFile(await captureRiskExport(risks, assets)), risks, assets);
    expect(rr.rows).toEqual([]);
    expect(rr.errors.map((e) => e.field)).toEqual(['Risk ID']);

    const t: Treatment = { id: 'TRT-001', riskIds: ['RSK-001'], title: 'T', description: '', owner: '', dueDate: '', status: 'Open', evidence: [], comments: [], submittedAt: '2025-01-01' };
    const rt = await parseTreatmentsFile(csvFile(await captureTreatmentExport([t])), [t], risks);
    expect(rt.rows).toEqual([]);
    expect(rt.errors.map((e) => e.field)).toEqual(['Treatment ID']);
  });

  it('RCSA: armored, padded or whitespace-padded ID values are non-blank and blocked; whitespace-only is blank', async () => {
    const r = await parseAssetsFile(csvFile(`Asset ID,Name\n"'=X",A\n" AST-1 ",B\n"  ",C\n`), []);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Asset ID'], [3, 'Asset ID']]);
    expect(r.rows.map((a) => a.name)).toEqual(['C']);
  });

  it('reference columns are not row IDs: Asset ID in a risk file, Risk ID / Risk IDs in a treatment file', async () => {
    const assets = [asset('AST-001')];
    expect((await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\n'), [], assets)).errors).toEqual([]);
    const risks = [risk('RSK-001')];
    expect((await parseTreatmentsFile(csvFile('Title,Risk ID\nX,RSK-001\n'), [], risks)).errors).toEqual([]);
    expect((await parseTreatmentsFile(csvFile('Title,Risk IDs\nX,RSK-001\n'), [], risks)).errors).toEqual([]);
  });

  it('allocation skips a stored case/padding variant of the candidate (variant-safe allocator)', async () => {
    const existing = [asset('AST-101'), asset('ast-0102'), asset(' AST-103')];
    const r = await parseAssetsFile(csvFile('Name\nA\nB\n'), existing);
    expect(r.rows.map((a) => a.id)).toEqual(['AST-104', 'AST-105']);
  });
});

// ── T-Q: strict CSV grammar, the same table for both parsers (R5-2) ─────────
const MALFORMED: [string, string][] = [
  ['quote inside an unquoted value', 'Name\nAST-"001"\n'],
  ['quote at the end of an unquoted value', 'Name\nAST-001"\n'],
  ['characters after a closing quote', 'Name\n"AST-001"x\n'],
  ['unclosed quote', 'Name\n"AST-001\n'],
  ['bare CR in an unquoted value', 'Name\nAST-1\rAST-2\n'],
  ['bare CR after a closing quote', 'Name\n"A"\rB\n'],
];

describe('T-Q: malformed CSV is a file error in BOTH parsers', () => {
  it.each(MALFORMED)('RCSA parser: %s', async (_label, csv) => {
    fileError(await parseAssetsFile(csvFile(csv), []));
  });
  it.each(MALFORMED)('standalone parser: %s', (_label, csv) => {
    fileError(importCsvText(vendorIo, csv, []));
  });

  it('the file error names the spreadsheet row (CSV record) and column', async () => {
    const r = await parseAssetsFile(csvFile('Name,Notes\nOK,"multi\nline"\nX,AST-"001"\n'), []);
    expect(r.errors[0]).toMatchObject({ row: 3, field: 'File' });
    expect(r.errors[0].message).toMatch(/^Row 3, column 2: a quote character inside an unquoted value/);
  });
});

describe('T-Q: valid RFC-4180 input is preserved exactly in BOTH parsers', () => {
  const VALID: [string, string, string][] = [
    ['escaped quotes', 'Name\n"He said ""hi"""\n', 'He said "hi"'],
    ['quoted comma', 'Name\n"Core, Banking"\n', 'Core, Banking'],
    ['multi-line quoted field', 'Name\n"line 1\nline 2"\n', 'line 1\nline 2'],
    ['CRLF endings', 'Name\r\nSWIFT\r\n', 'SWIFT'],
    ['BOM', '﻿Name\nSWIFT\n', 'SWIFT'],
    ['spaces around a quoted field', 'Name,Department\n  "Core"  ,IT\n', 'Core'],
  ];
  it.each(VALID)('RCSA parser: %s', async (_label, csv, name) => {
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].name).toBe(name);
  });
  it.each(VALID)('standalone parser: %s', (_label, csv, name) => {
    const r = importCsvText(vendorIo, csv, []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].name).toBe(name);
  });
  it('blank lines are still skipped and not counted', () => {
    const r = importCsvText(vendorIo, 'Name\nA\n\n\r\nB\n', []);
    expect(r.rows.map((v) => v.name)).toEqual(['A', 'B']);
    expect(r.totalDataRows).toBe(2);
  });
});

describe('T-Q: malformed input can never redirect a relationship (raw files)', () => {
  const assets = [asset('AST-"001"'), asset('AST-001'), asset('AST-1\rAST-2'), asset('AST-1AST-2')];
  const risks = [risk('RSK-"001"'), risk('RSK-001'), risk('RSK-1\rRSK-2'), risk('RSK-1RSK-2')];

  it('Risk → Asset: AST-"001" and an unquoted bare CR are file errors; a quoted CR is rejected as delimiter-bearing', async () => {
    fileError(await parseRisksFile(csvFile('Asset ID,Threat\nAST-"001",DDoS\n'), [], assets));
    fileError(await parseRisksFile(csvFile('Asset ID,Threat\nAST-1\rAST-2,DDoS\n'), [], assets));
    const quoted = await parseRisksFile(csvFile('Asset ID,Threat\n"AST-1\rAST-2",DDoS\n'), [], assets);
    expect(quoted.rows).toEqual([]);
    expect(quoted.errors[0].message).toMatch(/contains a list separator/);
  });

  it('Treatment → Risk: the same inputs, under both Risk ID and Risk IDs headers', async () => {
    for (const h of ['Risk ID', 'Risk IDs']) {
      fileError(await parseTreatmentsFile(csvFile(`Title,${h}\nX,RSK-"001"\n`), [], risks));
      fileError(await parseTreatmentsFile(csvFile(`Title,${h}\nX,RSK-1\rRSK-2\n`), [], risks));
      const quoted = await parseTreatmentsFile(csvFile(`Title,${h}\nX,"RSK-1\rRSK-2"\n`), [], risks);
      expect(quoted.rows, h).toEqual([]);
      expect(quoted.errors[0].message).toMatch(/contains a list separator/);
    }
  });

  it('a malformed row-ID cell is a file error too', async () => {
    fileError(await parseAssetsFile(csvFile('Asset ID,Name\nAST-"001",X\n'), []));
    fileError(importCsvText(vendorIo, 'ID,Name\nVEN-"01",X\n', []));
  });
});

// ── T-COL: identity / reference columns on the raw header row (R5-1) ─────────
describe('T-COL: identity and reference columns', () => {
  const assets = [asset('AST-001'), asset('AST-002')];
  const risks = [risk('RSK-001')];

  it('Risks: two Asset ID columns are a file error (both filled, or one blank)', async () => {
    for (const csv of ['Asset ID,Asset ID,Threat\nAST-404,AST-001,DDoS\n', 'Asset ID,Asset ID,Threat\n,AST-001,DDoS\n', 'asset_id, ASSET  ID ,Threat\nAST-001,,DDoS\n']) {
      const r = await parseRisksFile(csvFile(csv), [], assets);
      fileError(r);
      expect(r.errors[0].message).toMatch(/more than one asset-reference column/);
    }
  });

  it('Treatments: Risk ID + Risk IDs is a file error (both filled, identical, or one blank)', async () => {
    for (const csv of ['Title,Risk ID,Risk IDs\nX,RSK-001,RSK-404\n', 'Title,Risk ID,Risk IDs\nX,RSK-001,RSK-001\n', 'Title,Risk ID,Risk IDs\nX,,RSK-001\n']) {
      const r = await parseTreatmentsFile(csvFile(csv), [], risks);
      fileError(r);
      expect(r.errors[0].message).toMatch(/more than one risk-reference column/);
    }
  });

  it('a filled row-ID column cannot be hidden by a blank duplicate or alias (both orders)', async () => {
    for (const csv of ['Asset ID,ID,Name\n,AST-005,X\n', 'ID,Asset ID,Name\nAST-005,,X\n', 'Asset ID,Asset ID,Name\n,AST-005,X\n']) {
      const r = await parseAssetsFile(csvFile(csv), []);
      expect(r.rows, csv).toEqual([]);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].message).toMatch(CREATE_ONLY);
    }
    for (const csv of ['ID,Vendor ID,Name\n,VEN-05,X\n', 'Vendor ID,ID,Name\nVEN-05,,X\n', 'ID,ID,Name\n,VEN-05,X\n']) {
      const r = importCsvText(vendorIo, csv, []);
      expect(r.rows, csv).toEqual([]);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].message).toMatch(CREATE_ONLY);
    }
  });

  it('an unquoted comma in a reference cell is an unheaded-cell error, not a link to the first ID only', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001, AST-002,DDoS\n'), [], assets);
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.field)).toContain('Column 3');
    const t = importCsvText(vendorIo, 'Name,Criticality\nAcme, Inc.,High\n', []);
    expect(t.rows).toEqual([]);
    expect(t.errors.map((e) => e.field)).toContain('Column 3');
  });

  it('a non-blank cell under a blank header is a row error; trailing blank cells are fine', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,,Threat\nAST-001,X,DDoS\n'), [], assets);
    expect(r.errors.map((e) => e.field)).toEqual(['Column 2']);
    const ok = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS,,\n'), [], assets);
    expect(ok.errors).toEqual([]);
  });

  it('a row whose only value sits in an unheaded column is reported, not silently skipped', async () => {
    const r = await parseAssetsFile(csvFile('Name\n,orphan\n'), []);
    expect(r.totalDataRows).toBe(1);
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.field)).toContain('Column 2');
  });

  it('export-only named columns (Asset Name, Treatments) are still ignored', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Asset Name,Treatments,Threat\nAST-001,Whatever,TRT-009,DDoS\n'), [], assets);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].assetIds).toEqual(['AST-001']);
  });
});

// ── T-REF / T-REF-ARMOR on raw files, both relationships ─────────────────────
describe('T-REF-ARMOR: armored cells never link the competing apostrophe parent (raw files)', () => {
  const assetsTab: Asset[] = [asset('\t'), asset("'"), asset('AST-001')];
  const assetsCr: Asset[] = [asset('\r'), asset("'"), asset('AST-001')];
  const risksTab: Risk[] = [risk('\t'), risk("'"), risk('RSK-001')];
  const risksCr: Risk[] = [risk('\r'), risk("'"), risk('RSK-001')];

  const RISK_CASES: [string, string, Asset[]][] = [
    ['quoted apostrophe+tab', `"'\t"`, assetsTab],
    ['quoted apostrophe+CR', `"'\r"`, assetsCr],
    ['leading spaces', `"  '\t"`, assetsTab],
    ['armored list, tab parent first', `"'\t; AST-001"`, assetsTab],
    ['tab parent not first (blank-like parent stored)', `"AST-001; \t"`, assetsTab],
  ];

  it.each(RISK_CASES)('Risk → Asset: %s is rejected', async (_label, cell, assets) => {
    const r = await parseRisksFile(csvFile(`Asset ID,Threat\n${cell},DDoS\n`), [], assets);
    expect(r.rows).toEqual([]);
    blocked(r);
    expect(r.errors.every((e) => e.field === 'Asset ID')).toBe(true);
  });

  const TREATMENT_CASES: [string, string, Risk[]][] = [
    ['quoted apostrophe+tab', `"'\t"`, risksTab],
    ['quoted apostrophe+CR', `"'\r"`, risksCr],
    ['leading spaces', `"  '\t"`, risksTab],
    ['armored list, tab parent first', `"'\t; RSK-001"`, risksTab],
    ['tab parent not first (blank-like parent stored)', `"RSK-001; \t"`, risksTab],
  ];

  for (const header of ['Risk ID', 'Risk IDs']) {
    it.each(TREATMENT_CASES)(`Treatment → Risk (${header}): %s is rejected`, async (_label, cell, risks) => {
      const r = await parseTreatmentsFile(csvFile(`Title,${header}\nX,${cell}\n`), [], risks);
      expect(r.rows).toEqual([]);
      blocked(r);
      expect(r.errors.every((e) => e.field === 'Risk ID')).toBe(true);
    });
  }

  it('the same cases built from the REAL exporters are rejected after the ID column is cleared', async () => {
    const original = risk('RSK-001', { assetIds: ['\t', 'AST-001'] });
    const riskCsv = withIdColumnCleared(await captureRiskExport([original], assetsTab), 'Risk ID');
    expect(riskCsv).toContain(`"'\t; AST-001"`); // the exporter armored the tab-first list
    const rr = await parseRisksFile(csvFile(riskCsv), [original], assetsTab);
    expect(rr.rows).toEqual([]);
    expect(rr.errors.some((e) => /apostrophe added by CSV export/.test(e.message))).toBe(true);

    const t: Treatment = { id: 'TRT-001', riskIds: ['\t'], title: 'T', description: '', owner: '', dueDate: '', status: 'Open', evidence: [], comments: [], submittedAt: '2025-01-01' };
    const trtCsv = withIdColumnCleared(await captureTreatmentExport([t]), 'Treatment ID');
    expect(trtCsv).toContain(`"'\t"`);
    const rt = await parseTreatmentsFile(csvFile(trtCsv), [t], risksTab);
    expect(rt.rows).toEqual([]);
    expect(rt.errors.some((e) => /apostrophe added by CSV export/.test(e.message))).toBe(true);
  });

  it('controls: "\'" alone links the apostrophe parent; a trailing "; " is still dropped', async () => {
    const assets = [asset("'"), asset('AST-001')];
    const a = await parseRisksFile(csvFile(`Asset ID,Threat\n"'",DDoS\n"AST-001; ",DDoS\n`), [], assets);
    expect(a.errors).toEqual([]);
    expect(a.rows.map((x) => x.assetIds)).toEqual([["'"], ['AST-001']]);
  });
});

describe('T-REF: exact, fail-closed references on raw files', () => {
  it('Risk → Asset: case-only, padding variant, ambiguous group and delimiter-token overlap are rejected', async () => {
    const assets = [asset('AST-001'), asset('AST-500'), asset('ast-500'), asset('AST-7;AST-8'), asset('AST-7')];
    for (const ref of ['ast-001', 'AST-1', 'AST-500', 'ast-500', 'AST-7', '"AST-001; AST-1"']) {
      const r = await parseRisksFile(csvFile(`Asset ID,Threat\n${ref},DDoS\n`), [], assets);
      expect(r.rows, ref).toEqual([]);
      blocked(r);
    }
  });

  it('Treatment → Risk: the same rules', async () => {
    const risks = [risk('RSK-001'), risk('RSK-500'), risk('rsk-500'), risk('RSK-7,RSK-8'), risk('RSK-7')];
    for (const ref of ['rsk-001', 'RSK-1', 'RSK-500', 'rsk-500', 'RSK-7']) {
      const r = await parseTreatmentsFile(csvFile(`Title,Risk ID\nX,${ref}\n`), [], risks);
      expect(r.rows, ref).toEqual([]);
      blocked(r);
    }
  });

  it('any error anywhere blocks the whole file, not only the bad row', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\nAST-404,DDoS\n'), [], [asset('AST-001')]);
    expect(r.rows).toHaveLength(1); // the preview still lists the valid row …
    blocked(r); // … but the file has an error, so nothing can be imported
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S2 STEP 2 — persistence core (data/importCommit.ts)
// ═════════════════════════════════════════════════════════════════════════════
const ASSETS_KEY = 'rcsa.assets.v1';
const RISKS_KEY = 'rcsa.risks.v1';
const TREATMENTS_KEY = 'rcsa.treatments.v1';
const ASSETS_TARGET = { key: ASSETS_KEY, label: 'Assets' };
const RISKS_TARGET = { key: RISKS_KEY, label: 'Risks' };
const TREATMENTS_TARGET = { key: TREATMENTS_KEY, label: 'Treatments', missingMessage: 'Treatments are not initialised in this browser. Nothing was imported.' };
const ASSET_PARENT: ImportParent<Risk> = { key: ASSETS_KEY, label: 'assets', labels: { parent: 'asset', column: 'Asset ID' }, refsOf: (r) => r.assetIds };
const RISK_PARENT: ImportParent<Treatment> = { key: RISKS_KEY, label: 'risks', labels: { parent: 'risk', column: 'Risk ID' }, refsOf: (t) => t.riskIds };

const allKeys = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
const store = (key: string, value: unknown) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
const treatment = (id: string, riskIds: string[]): Treatment => ({
  id, riskIds, title: `T ${id}`, description: '', owner: '', dueDate: '', status: 'Open', evidence: [], comments: [], submittedAt: '2025-01-01',
});
const originalSetItem = Storage.prototype.setItem;
const originalGetItem = Storage.prototype.getItem;

/** Run `fn` and assert it made NO localStorage write call and changed no key. */
function expectZeroWrites<R>(fn: () => R): R {
  const before = allKeys();
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
  const out = fn();
  expect(setItem, 'no setItem call').not.toHaveBeenCalled();
  expect(removeItem, 'no removeItem call').not.toHaveBeenCalled();
  setItem.mockRestore();
  removeItem.mockRestore();
  expect(allKeys(), 'every key unchanged').toEqual(before);
  return out;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('Step 2: a verified create-only commit (T-P)', () => {
  it('appends the preview rows after the existing records and verifies the read-back', async () => {
    const assets = [asset('AST-001'), asset('AST-002')];
    store(ASSETS_KEY, assets);
    const preview = await parseAssetsFile(csvFile('Name\nNew A\nNew B\n'), assets);
    expect(preview.errors).toEqual([]);
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: preview.rows });
    expect(result.status).toBe('verified');
    const stored = JSON.parse(localStorage.getItem(ASSETS_KEY)!) as Asset[];
    expect(stored.map((a) => a.id)).toEqual(['AST-001', 'AST-002', 'AST-003', 'AST-004']);
    expect(result).toMatchObject({ written: 2, records: stored });
  });

  it('end to end with the real parser: risks link exact assets; treatments link exact risks', async () => {
    const assets = [asset('AST-001'), asset('AST-002')];
    store(ASSETS_KEY, assets);
    store(RISKS_KEY, []);
    store(TREATMENTS_KEY, []);
    const risks = await parseRisksFile(csvFile('Asset ID,Threat\n"AST-001; AST-002",DDoS\n'), [], assets);
    expect(commitNewRecords({ target: RISKS_TARGET, rows: risks.rows, parent: ASSET_PARENT }).status).toBe('verified');
    const storedRisks = JSON.parse(localStorage.getItem(RISKS_KEY)!) as Risk[];
    expect(storedRisks.map((r) => [r.id, r.assetIds])).toEqual([['RSK-001', ['AST-001', 'AST-002']]]);
    const trts = await parseTreatmentsFile(csvFile('Title,Risk ID\nPatch,RSK-001\n'), [], storedRisks);
    expect(commitNewRecords({ target: TREATMENTS_TARGET, rows: trts.rows, parent: RISK_PARENT }).status).toBe('verified');
    expect((JSON.parse(localStorage.getItem(TREATMENTS_KEY)!) as Treatment[]).map((t) => [t.id, t.riskIds])).toEqual([['TRT-001', ['RSK-001']]]);
  });

  it('existing records stay BYTE-identical, including hand-formatted JSON and legacy fields (T-L)', () => {
    // Legacy risk shapes: embedded treatment-plan fields and a single assetId.
    const raw = '[\n  {"id":"RSK-001","assetId":"AST-001","actionPlan":"Patch it","responsible":"Ops","deadline":"2025-01-01","treatmentStatus":"Open","threat":"DDoS"},\n' +
      '  { "threat" : "Old" , "id" : "RSK-002", "impact": 1.0, "note": "caf\\u00e9" }\n]\n';
    store(RISKS_KEY, raw);
    store(ASSETS_KEY, [asset('AST-001')]);
    const result = commitNewRecords({ target: RISKS_TARGET, rows: [risk('RSK-003')], parent: ASSET_PARENT });
    expect(result.status).toBe('verified');
    const after = localStorage.getItem(RISKS_KEY)!;
    const j = raw.lastIndexOf(']');
    expect(after.startsWith(raw.slice(0, j)), 'the stored prefix is untouched byte for byte').toBe(true);
    expect(after.endsWith(raw.slice(j)), 'the closing bracket and trailing text are untouched').toBe(true);
    expect(after.slice(j, after.length - (raw.length - j))).toBe(`,${JSON.stringify(risk('RSK-003'))}`);
    const parsed = JSON.parse(after) as Record<string, unknown>[];
    expect(parsed[0]).toMatchObject({ assetId: 'AST-001', actionPlan: 'Patch it', responsible: 'Ops', deadline: '2025-01-01', treatmentStatus: 'Open' });
    expect(parsed.map((r) => r.id)).toEqual(['RSK-001', 'RSK-002', 'RSK-003']);
  });

  it('an empty stored array receives the rows; untouched keys are never written', () => {
    store(ASSETS_KEY, []);
    store(RISKS_KEY, '[{"id":"RSK-001"}]');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    expect(commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-001')] }).status).toBe('verified');
    expect(setItem.mock.calls.map(([k]) => k), 'exactly one write, to the target key').toEqual([ASSETS_KEY]);
    expect(localStorage.getItem(RISKS_KEY)).toBe('[{"id":"RSK-001"}]');
  });

  it('commits never call a repository list/read, seed or migration (raw reads only)', () => {
    store(ASSETS_KEY, [asset('AST-001')]);
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-002')] });
    // Reads: the target (Phase 1) and the target again (read-back) — nothing else.
    expect(getItem.mock.calls.map(([k]) => k)).toEqual([ASSETS_KEY, ASSETS_KEY]);
  });

  it('appends 1,000 rows to 10,000 stored records quickly, preserving order', () => {
    const existing = Array.from({ length: 10_000 }, (_, i) => asset(`AST-${String(i + 1).padStart(5, '0')}`));
    store(ASSETS_KEY, existing);
    const rows = Array.from({ length: 1_000 }, (_, i) => asset(`AST-${10_001 + i}`));
    const t0 = performance.now();
    const result = commitNewRecords({ target: ASSETS_TARGET, rows });
    const ms = performance.now() - t0;
    expect(result.status).toBe('verified');
    const stored = JSON.parse(localStorage.getItem(ASSETS_KEY)!) as Asset[];
    expect(stored).toHaveLength(11_000);
    expect(stored[9_999].id).toBe('AST-10000');
    expect(stored[10_000].id).toBe('AST-10001');
    expect(stored[10_999].id).toBe('AST-11000');
    expect(ms, `took ${ms.toFixed(0)} ms`).toBeLessThan(3_000);
  });
});

describe('Step 2: stale preview — rejected before any write (T-S)', () => {
  it('an allocated ID taken after the preview is refused, exactly and as any collision variant', async () => {
    for (const taken of ['AST-002', 'ast-002', 'AST-0002', ' AST-2 ']) {
      localStorage.clear();
      store(ASSETS_KEY, [asset('AST-001')]);
      const preview = await parseAssetsFile(csvFile('Name\nNew\n'), [asset('AST-001')]);
      expect(preview.rows[0].id).toBe('AST-002');
      store(ASSETS_KEY, [asset('AST-001'), asset(taken)]); // "another tab"
      const result = expectZeroWrites(() => commitNewRecords({ target: ASSETS_TARGET, rows: preview.rows }));
      expect(result.status, taken).toBe('rejected');
      expect(result.status === 'rejected' && result.reasons[0]).toMatch(/AST-002 \(or a variant of it\) was created after the preview/);
    }
  });

  it('B-3, Risk → Asset: a parent deleted, made ambiguous or overlapped by a delimiter-bearing ID is refused', async () => {
    const assets = [asset('AST-001'), asset('AST-010')];
    const preview = await parseRisksFile(csvFile('Asset ID,Threat\n"AST-001; AST-010",DDoS\n'), [], assets);
    expect(preview.errors).toEqual([]);
    const cases: [string, Asset[], RegExp][] = [
      ['deleted', [asset('AST-001')], /No asset "AST-010" exists/],
      ['ambiguous', [...assets, asset('ast-010')], /is ambiguous/],
      ['padding variant makes it ambiguous', [...assets, asset('AST-0010')], /is ambiguous/],
      ['delimiter overlap', [...assets, asset('AST-010;AST-099')], /contains a list separator, so this cell may refer to it/],
    ];
    for (const [label, parents, message] of cases) {
      localStorage.clear();
      store(RISKS_KEY, []);
      store(ASSETS_KEY, parents);
      const result = expectZeroWrites(() => commitNewRecords({ target: RISKS_TARGET, rows: preview.rows, parent: ASSET_PARENT }));
      expect(result.status, label).toBe('rejected');
      expect(result.status === 'rejected' && result.reasons.join(' '), label).toMatch(message);
      expect(result.status === 'rejected' && result.reasons.join(' ')).toMatch(/RSK-001: the linked asset "AST-010" changed after the preview/);
    }
  });

  it('B-3, Treatment → Risk: the same checks', async () => {
    const risks = [risk('RSK-001')];
    const preview = await parseTreatmentsFile(csvFile('Title,Risk ID\nPatch,RSK-001\n'), [], risks);
    for (const parents of [[], [risk('RSK-001'), risk('rsk-001')], [risk('RSK-001'), risk('RSK-001,RSK-002')]]) {
      localStorage.clear();
      store(TREATMENTS_KEY, []);
      store(RISKS_KEY, parents);
      const result = expectZeroWrites(() => commitNewRecords({ target: TREATMENTS_TARGET, rows: preview.rows, parent: RISK_PARENT }));
      expect(result.status).toBe('rejected');
    }
  });

  it('B-3: a parent edited after the preview with its ID unchanged is still accepted', async () => {
    store(ASSETS_KEY, [asset('AST-001')]);
    store(RISKS_KEY, []);
    const preview = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\n'), [], [asset('AST-001')]);
    store(ASSETS_KEY, [asset('AST-001', { name: 'Renamed elsewhere' })]);
    expect(commitNewRecords({ target: RISKS_TARGET, rows: preview.rows, parent: ASSET_PARENT }).status).toBe('verified');
  });

  it('an empty batch or a batch with duplicate keys is refused without writing', () => {
    store(ASSETS_KEY, []);
    expect(expectZeroWrites(() => commitNewRecords({ target: ASSETS_TARGET, rows: [] })).status).toBe('rejected');
    const dup = expectZeroWrites(() => commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-001'), asset('ast-1')] }));
    expect(dup.status === 'rejected' && dup.reasons.join(' ')).toMatch(/appears twice/);
  });
});

describe('Step 2: missing, malformed or unreadable storage — fail closed, zero writes (T-SE)', () => {
  it.each([
    ['missing target key', () => {}, /The stored Assets collection is missing/],
    ['corrupt JSON', () => store(ASSETS_KEY, '[{"id":'), /The stored Assets data is unreadable/],
    ['not an array', () => store(ASSETS_KEY, '{"id":"AST-001"}'), /unreadable/],
    ['an element without a string id', () => store(ASSETS_KEY, '[{"id":"AST-001"},{"name":"x"}]'), /unreadable/],
    ['an element that is not an object', () => store(ASSETS_KEY, '[{"id":"AST-001"},"AST-002"]'), /unreadable/],
  ] as const)('%s', (_label, arrange, message) => {
    arrange();
    const result = expectZeroWrites(() => commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-900')] }));
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.reasons[0]).toMatch(message);
  });

  it('missing treatments with legacy risks stored: refused, no seed and no migration', () => {
    store(RISKS_KEY, [{ id: 'RSK-001', assetId: 'AST-001', actionPlan: 'Keep me' }]);
    const result = expectZeroWrites(() => commitNewRecords({ target: TREATMENTS_TARGET, rows: [treatment('TRT-001', ['RSK-001'])], parent: RISK_PARENT }));
    expect(result).toEqual({ status: 'rejected', reasons: ['Treatments are not initialised in this browser. Nothing was imported.'] });
    expect(localStorage.getItem(TREATMENTS_KEY)).toBeNull();
  });

  it('a missing or unreadable parent collection is refused (links cannot be verified)', () => {
    for (const arrange of [() => {}, () => store(ASSETS_KEY, 'nope'), () => store(ASSETS_KEY, '[{"name":"no id"}]')]) {
      localStorage.clear();
      store(RISKS_KEY, []);
      arrange();
      const result = expectZeroWrites(() => commitNewRecords({ target: RISKS_TARGET, rows: [risk('RSK-001')], parent: ASSET_PARENT }));
      expect(result.status === 'rejected' && result.reasons[0]).toMatch(/The stored assets cannot be read, so the links cannot be verified/);
    }
  });

  it('getItem throwing (storage unavailable) is refused without writing', () => {
    store(ASSETS_KEY, []);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    // (expectZeroWrites cannot snapshot keys here — every getItem throws.)
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-001')] });
    expect(result).toEqual({ status: 'rejected', reasons: ['Browser storage is not available. Nothing was imported.'] });
    expect(setItem, 'no write call').not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(localStorage.getItem(ASSETS_KEY)).toBe('[]');
  });
});

describe('Step 2: write and read-back failures — honest outcomes, no retry, no rollback (T-W)', () => {
  const arrange = () => { store(ASSETS_KEY, [asset('AST-001')]); return localStorage.getItem(ASSETS_KEY)!; };

  it('setItem throws (quota) and the value is unchanged: REJECTED, nothing written, one attempt only', () => {
    const before = arrange();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-002')] });
    expect(result).toEqual({ status: 'rejected', reasons: ['Saving failed (browser storage is full or unavailable). Nothing was imported.'] });
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ASSETS_KEY)).toBe(before);
  });

  it('setItem writes and then throws: UNCERTAIN, never retried, never rolled back', () => {
    arrange();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      originalSetItem.call(this, k, v);
      throw new Error('late failure');
    });
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-002')] });
    expect(result.status).toBe('uncertain');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect((JSON.parse(localStorage.getItem(ASSETS_KEY)!) as Asset[]).map((a) => a.id)).toEqual(['AST-001', 'AST-002']);
  });

  it('setItem returns but the read-back differs (e.g. another tab wrote): UNCERTAIN, one attempt only', () => {
    arrange();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string) {
      originalSetItem.call(this, k, '[{"id":"AST-777"}]'); // what "another tab" left behind
    });
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-002')] });
    expect(result.status).toBe('uncertain');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ASSETS_KEY)).toBe('[{"id":"AST-777"}]'); // left as found: no rollback
  });

  it('the read-back throws: UNCERTAIN', () => {
    arrange();
    let wrote = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      originalSetItem.call(this, k, v);
      wrote = true;
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (wrote) throw new Error('read-back failed');
      return originalGetItem.call(this, k);
    });
    const result = commitNewRecords({ target: ASSETS_TARGET, rows: [asset('AST-002')] });
    expect(result.status).toBe('uncertain');
  });
});

describe('Step 2: readForImport — the read-only refresh source (§4.6)', () => {
  it('reports ok / missing / unreadable / unavailable without writing or normalising', () => {
    expect(expectZeroWrites(() => readForImport(ASSETS_KEY))).toEqual({ status: 'missing' });
    store(ASSETS_KEY, 'not json');
    expect(expectZeroWrites(() => readForImport(ASSETS_KEY))).toEqual({ status: 'unreadable' });
    store(ASSETS_KEY, '{"a":1}');
    expect(readForImport(ASSETS_KEY)).toEqual({ status: 'unreadable' });
    store(RISKS_KEY, [{ id: 'RSK-001', assetId: 'AST-001', actionPlan: 'kept' }]);
    expect(expectZeroWrites(() => readForImport(RISKS_KEY))).toEqual({ status: 'ok', records: [{ id: 'RSK-001', assetId: 'AST-001', actionPlan: 'kept' }] });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(readForImport(ASSETS_KEY)).toEqual({ status: 'unavailable' });
  });
});

// ── Duplicate parent records with an IDENTICAL ID (Codex S2 step 2 review) ────
// Two stored parents with exactly the same ID cannot be told apart, so any
// reference to that ID is ambiguous — at preview and at commit (B-3). Stored
// duplicates are never repaired, deduplicated or rewritten.
describe('Duplicate parent IDs: rejected at preview and at commit, both relationships', () => {
  it('Risk → Asset: duplicates already present before the preview block the file', async () => {
    const assets = [asset('AST-010', { name: 'First' }), asset('AST-010', { name: 'Second' }), asset('AST-001')];
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\nAST-010,Fire\n'), [], assets);
    expect(r.errors).toEqual([{ row: 3, field: 'Asset ID', message: '"AST-010" is ambiguous: 2 stored assets have exactly this ID. Link it in the form.' }]);
    blocked(r); // the whole file is blocked, including the valid AST-001 row
  });

  it('Treatment → Risk: duplicates already present before the preview block the file', async () => {
    const risks = [risk('RSK-010'), risk('RSK-010'), risk('RSK-001')];
    for (const header of ['Risk ID', 'Risk IDs']) {
      const r = await parseTreatmentsFile(csvFile(`Title,${header}\nOk,RSK-001\nX,"RSK-001; RSK-010"\n`), [], risks);
      expect(r.errors, header).toEqual([{ row: 3, field: 'Risk ID', message: '"RSK-010" is ambiguous: 2 stored risks have exactly this ID. Link it in the form.' }]);
      blocked(r);
    }
  });

  it('Risk → Asset: a duplicate introduced after the preview is refused at commit with zero writes; nothing is repaired', async () => {
    const assets = [asset('AST-001'), asset('AST-010')];
    store(ASSETS_KEY, assets);
    store(RISKS_KEY, []);
    const preview = await parseRisksFile(csvFile('Asset ID,Threat\n"AST-001; AST-010",DDoS\n'), [], assets);
    expect(preview.errors).toEqual([]);
    const withDuplicate = '[' + [asset('AST-001'), asset('AST-010'), asset('AST-010', { name: 'Twin' })].map((a) => JSON.stringify(a)).join(',') + ']';
    store(ASSETS_KEY, withDuplicate); // "another tab"
    const result = expectZeroWrites(() => commitNewRecords({ target: RISKS_TARGET, rows: preview.rows, parent: ASSET_PARENT }));
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.reasons).toEqual([
      'RSK-001: the linked asset "AST-010" changed after the preview. "AST-010" is ambiguous: 2 stored assets have exactly this ID. Link it in the form.',
    ]);
    expect(localStorage.getItem(ASSETS_KEY), 'stored duplicates are left exactly as found').toBe(withDuplicate);
    expect(localStorage.getItem(RISKS_KEY)).toBe('[]');
  });

  it('Treatment → Risk: a duplicate introduced after the preview is refused at commit with zero writes; nothing is repaired', async () => {
    const risks = [risk('RSK-001')];
    store(RISKS_KEY, risks);
    store(TREATMENTS_KEY, []);
    const preview = await parseTreatmentsFile(csvFile('Title,Risk ID\nPatch,RSK-001\n'), [], risks);
    expect(preview.errors).toEqual([]);
    const withDuplicate = JSON.stringify([risk('RSK-001'), risk('RSK-001', { threat: 'Twin' })]);
    store(RISKS_KEY, withDuplicate);
    const result = expectZeroWrites(() => commitNewRecords({ target: TREATMENTS_TARGET, rows: preview.rows, parent: RISK_PARENT }));
    expect(result.status).toBe('rejected');
    expect(result.status === 'rejected' && result.reasons.join(' ')).toMatch(/TRT-001: the linked risk "RSK-001" changed after the preview\. "RSK-001" is ambiguous: 2 stored risks have exactly this ID/);
    expect(localStorage.getItem(RISKS_KEY)).toBe(withDuplicate);
    expect(localStorage.getItem(TREATMENTS_KEY)).toBe('[]');
  });

  it('control: unique parents and valid references still commit (preview and commit), unaffected by an unrelated duplicate', async () => {
    const assets = [asset('AST-001'), asset('AST-099'), asset('AST-099')]; // duplicate, but not referenced
    store(ASSETS_KEY, assets);
    store(RISKS_KEY, []);
    const preview = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\n'), [], assets);
    expect(preview.errors).toEqual([]);
    expect(commitNewRecords({ target: RISKS_TARGET, rows: preview.rows, parent: ASSET_PARENT }).status).toBe('verified');
    expect((JSON.parse(localStorage.getItem(RISKS_KEY)!) as Risk[]).map((r) => r.assetIds)).toEqual([['AST-001']]);
  });
});
