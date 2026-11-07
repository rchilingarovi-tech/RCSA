// ID integrity S2 — Step 1 regression tests (preview level): create-only
// identity, strict CSV grammar, identity/reference columns, exact fail-closed
// references and the armor-before-trim order.
// Design: docs/ID_INTEGRITY_S2_DESIGN.md §3 and §9.1 (T-ID, T-Q, T-COL, T-REF,
// T-REF-ARMOR). "Blocked" = the preview has errors, so the UI cannot import
// (asserted for the UIs in import-commit-ui.test.tsx). Commit-time and
// zero-write assertions for the commit path belong to S2 steps 2-4.
import { describe, expect, it, vi } from 'vitest';
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
