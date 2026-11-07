// Characterization tests for the RCSA CSV importers (io/import.ts): RFC-4180
// parsing, row validation, id resolution and referential checks.
import { describe, expect, it } from 'vitest';
import type { Treatment } from '../data/models';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile } from './import';
import { csvFile, freezeLocalTime, knownDefect } from '../test/helpers';
import {
  INVALID_SCORES, ROUND_TRIP_ASSETS, YES_NO_COLUMNS, asset, captureRiskExport, invalidScoreDefect,
  invalidYesNoDefect, risk, roundTripApostropheDefect, roundTripScoresDefect, treatmentOverdueRoundTripDefect,
  withIdColumnCleared,
} from '../test/defects/rcsaImport';

const CREATE_ONLY = /CSV import creates new records only, and IDs are assigned automatically/;

const ASSET_HEADER = 'Asset ID,Name,Process,Department,Business Owner,IT Owner,Applicant,C,I,A,Data Class,PCI,Critical Process,Internet Facing,Third Party,Cloud,Status,Review Date,Evidence,Notes';

const existingTreatment = (id: string): Treatment => ({
  id, riskIds: ['RSK-001'], title: 'Old', description: '', owner: '', dueDate: '', status: 'Open',
  evidence: [], comments: [], submittedAt: '2025-01-01',
});

// ── CSV parsing (shared by all three importers) ─────────────────────────────
describe('CSV parsing', () => {
  it('handles quoted commas, escaped quotes and embedded newlines', async () => {
    const csv = `Name,Notes\n"Core, Banking","He said ""hi""\nsecond line"\n`;
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].name).toBe('Core, Banking');
    expect(r.rows[0].notes).toBe('He said "hi"\nsecond line');
  });

  it('strips a UTF-8 BOM and accepts CRLF line endings', async () => {
    const csv = '﻿Name,Department\r\nSWIFT,Treasury\r\n';
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: 'SWIFT', department: 'Treasury' });
  });

  it('skips blank lines and does not count them as data rows', async () => {
    const csv = 'Name\nA\n\n , \nB\n';
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.rows.map((a) => a.name)).toEqual(['A', 'B']);
    expect(r.totalDataRows).toBe(2);
  });

  it('matches headers case- and spacing-insensitively, with aliases', async () => {
    const csv = 'asset name,DATA_CLASS,internet,confidentiality\nX,personal data,y,3\n';
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: 'X', dataClass: 'Personal Data', internet: 'Yes', c: 3 });
  });

  it('returns an empty result for an empty file', async () => {
    const r = await parseAssetsFile(csvFile(''), []);
    expect(r).toEqual({ rows: [], created: 0, updated: 0, errors: [], skipped: 0, totalDataRows: 0 });
  });
});

// ── Assets ───────────────────────────────────────────────────────────────────
describe('parseAssetsFile', () => {
  it('imports a complete row with typed values', async () => {
    freezeLocalTime(2026, 11, 5);
    const csv = `${ASSET_HEADER}\n,Core Banking,Payments,IT,Head,SysAdmin,Nino,3,2,3,Payment Data,Yes,true,0,No,n,Approved,2027-01-01,a.pdf; b.pdf,note\n`;
    const r = await parseAssetsFile(csvFile(csv), []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toEqual({
      id: 'AST-001', name: 'Core Banking', process: 'Payments', department: 'IT', busOwner: 'Head',
      itOwner: 'SysAdmin', applicantName: 'Nino', c: 3, i: 2, a: 3, dataClass: 'Payment Data',
      pci: 'Yes', criticalProcess: 'Yes', internet: 'No', thirdParty: 'No', cloud: 'No', status: 'Approved',
      reviewDate: '2027-01-01', evidence: ['a.pdf', 'b.pdf'], notes: 'note', submittedAt: '2026-11-05',
    });
    expect(r.created).toBe(1);
  });

  it('applies defaults for blank optional cells', async () => {
    const r = await parseAssetsFile(csvFile('Name\nBare\n'), []);
    expect(r.rows[0]).toMatchObject({ c: 1, i: 1, a: 1, dataClass: 'Internal', status: 'Draft', pci: 'No', evidence: [] });
  });

  it('rejects rows with a missing name, reporting the spreadsheet row number', async () => {
    const r = await parseAssetsFile(csvFile('Name,Department\nOK,IT\n,HR\n'), []);
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, field: 'Name', message: 'Name is required' }]);
  });

  it.each([
    ['C', '4', '"4" must be 1, 2 or 3'],
    ['C', '2.5', '"2.5" must be 1, 2 or 3'],
    ['Data Class', 'Secret', '"Secret" is not one of: Public, Internal, Confidential, Personal Data, Payment Data'],
    ['Status', 'Done', '"Done" is not one of: Draft, Submitted, Reviewed by InfoSec, Approved, Needs Update'],
  ])('rejects invalid %s value %s', async (col, val, message) => {
    const r = await parseAssetsFile(csvFile(`Name,${col}\nX,${val}\n`), []);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toEqual([{ row: 2, field: col, message }]);
  });

  // Known defect: an invalid Yes/No value is imported as "No" with no error.
  // Spec (observe / invariants / correct / exact documented symptom) lives in
  // src/test/defects/rcsaImport.ts.
  knownDefect.each(YES_NO_COLUMNS.map(([col]) => [col] as const))(
    'rejects an invalid %s value instead of silently importing "No"',
    (col) => invalidYesNoDefect(col),
  );

  it('fixture: the same "maybe" value IS rejected for C (a field validated before the error check)', async () => {
    const r = await parseAssetsFile(csvFile('Name,C\nX,maybe\n'), []);
    expect(r.rows).toHaveLength(0);
  });

  it('reports every error on a row, not just the first', async () => {
    const r = await parseAssetsFile(csvFile('Name,C,I\n,9,9\n'), []);
    expect(r.errors.map((e) => e.field)).toEqual(['Name', 'C', 'I']);
    expect(r.skipped).toBe(1);
  });

  // S2 (create-only): was "an existing id (any case) is an update and keeps the
  // original submittedAt". The update operation no longer exists; the
  // update-only submittedAt assertion is retired with it (design §9.2 #1).
  it('a non-blank Asset ID (existing, case variant or unknown) blocks the file; nothing is updated', async () => {
    const r = await parseAssetsFile(csvFile('Asset ID,Name\nAST-002,Renamed\nast-002,Renamed\nAST-900,New\n'), [asset('AST-002')]);
    expect(r.rows).toEqual([]);
    expect(r.updated).toBe(0);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Asset ID'], [3, 'Asset ID'], [4, 'Asset ID']]);
    r.errors.forEach((e) => expect(e.message).toMatch(CREATE_ONLY));
  });

  it('allocates new ids after the HIGHEST existing number, not the count', async () => {
    const existing = [asset('AST-001'), asset('AST-100')]; // gap: 2 assets, max 100
    const r = await parseAssetsFile(csvFile('Name\nA\nB\n'), existing);
    expect(r.rows.map((a) => a.id)).toEqual(['AST-101', 'AST-102']);
  });

  // S2 (create-only): was "keeps an unknown explicit id, and gives a duplicate a
  // fresh unique id". Explicit IDs are now rejected (both rows reported); unique
  // allocation stays covered by the HIGHEST-number test above (design §9.2 #2).
  it('explicit IDs are rejected, duplicates included — every such row is reported', async () => {
    const r = await parseAssetsFile(csvFile('Asset ID,Name\nAST-500,A\nAST-500,B\n'), []);
    expect(r.rows).toEqual([]);
    expect(r.created).toBe(0);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Asset ID'], [3, 'Asset ID']]);
  });
});

// ── Risks ────────────────────────────────────────────────────────────────────
describe('parseRisksFile', () => {
  const assets = [asset('AST-001'), asset('AST-002')];

  it('imports a risk spanning several assets with optional residual scoring', async () => {
    const csv = 'Risk ID,Asset ID,Threat,Impact,Likelihood,Residual Impact,Residual Likelihood,Decision,Controls\n' +
      ',"AST-001; AST-002, AST-001",DDoS,5,4,2,2,accept,MFA enabled; Quarterly firewall review\n';
    const r = await parseRisksFile(csvFile(csv), [], assets);
    expect(r.errors).toEqual([]);
    // The exact duplicate AST-001 is still dropped.
    expect(r.rows[0]).toMatchObject({
      id: 'RSK-001', assetIds: ['AST-001', 'AST-002'], threat: 'DDoS', customThreat: false,
      impact: 5, likelihood: 4, resImpact: 2, resLikelihood: 2, assessment: 'Accept',
      controls: ['MFA enabled', 'Quarterly firewall review'],
    });
  });

  // S2: references are exact (design §9.2 #3).
  it('a case-only asset reference is rejected, not rewritten', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nast-001,DDoS\n'), [], assets);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ row: 2, field: 'Asset ID', message: '"ast-001" does not exist. An asset "AST-001" exists; IDs must match exactly.' }]);
  });

  it('leaves residual unassessed when the cells are blank', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,DDoS\n'), [], assets);
    expect(r.rows[0].resImpact).toBeUndefined();
    expect(r.rows[0].resLikelihood).toBeUndefined();
    expect(r.rows[0]).toMatchObject({ impact: 1, likelihood: 1, assessment: 'Mitigate' });
  });

  it('flags threats outside the catalogue as custom', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,Insider threat\n'), [], assets);
    expect(r.rows[0].customThreat).toBe(true);
  });

  it('requires at least one asset, and every asset must exist', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\n,DDoS\nAST-999,DDoS\n'), [], assets);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toEqual([
      { row: 2, field: 'Asset ID', message: 'At least one Asset ID is required' },
      { row: 3, field: 'Asset ID', message: 'No asset "AST-999" exists — import the asset first' },
    ]);
  });

  it('rejects an invalid Decision', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat,Decision\nAST-001,DDoS,Ignore\n'), [], assets);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toEqual([{ row: 2, field: 'Decision', message: 'must be: Mitigate, Accept, Transfer, Avoid' }]);
  });

  // Known defect: an invalid score is imported as 1 / "not assessed" with no
  // error (e.g. "Impact = 6" lands as Impact 1). Spec: src/test/defects/rcsaImport.ts.
  knownDefect.each(INVALID_SCORES.map(([col, val]) => [col, val] as const))(
    'rejects an invalid %s (%s) instead of silently importing a default',
    (col, val) => invalidScoreDefect(col, val),
  );

  it('fixture: a valid score row with the same shape imports cleanly', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat,Impact\nAST-001,DDoS,4\n'), [], assets);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].impact).toBe(4);
  });

  it('requires a threat', async () => {
    const r = await parseRisksFile(csvFile('Asset ID,Threat\nAST-001,\n'), [], assets);
    expect(r.errors).toEqual([{ row: 2, field: 'Threat', message: 'Threat is required' }]);
  });

  // S2 (create-only): was "updates an existing risk by id and allocates new ids
  // after the highest" (design §9.2 #4). Split into the rejection and the
  // unchanged allocation.
  it('an explicit Risk ID (even an existing one) blocks the file', async () => {
    const existing = [risk('RSK-001'), risk('RSK-007')];
    const csv = 'Risk ID,Asset ID,Threat\nRSK-007,AST-002,Eavesdropping\n,AST-001,DDoS\n';
    const r = await parseRisksFile(csvFile(csv), existing, assets);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Risk ID']]);
    expect(r.errors[0].message).toMatch(CREATE_ONLY);
    expect(r.updated).toBe(0);
  });

  it('allocates new risk ids after the highest existing number', async () => {
    const existing = [risk('RSK-001'), risk('RSK-007')];
    const r = await parseRisksFile(csvFile('Risk ID,Asset ID,Threat\n,AST-002,Eavesdropping\n,AST-001,DDoS\n'), existing, assets);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.id)).toEqual(['RSK-008', 'RSK-009']);
    expect(r).toMatchObject({ updated: 0, created: 2 });
  });
});

// ── Treatments ───────────────────────────────────────────────────────────────
describe('parseTreatmentsFile', () => {
  const risks = [risk('RSK-001'), risk('RSK-002')];

  it('imports a treatment addressing several risks', async () => {
    const csv = 'Title,Risk IDs,Owner,Due Date,Status,Description\nDeploy EDR,"RSK-001;RSK-002",SecOps,2026-12-31,in progress,Roll out\n';
    const r = await parseTreatmentsFile(csvFile(csv), [], risks);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({
      id: 'TRT-001', riskIds: ['RSK-001', 'RSK-002'], title: 'Deploy EDR', owner: 'SecOps',
      dueDate: '2026-12-31', status: 'In Progress', description: 'Roll out',
    });
  });

  // S2: references are exact (design §9.2 #5).
  it('a case-only risk reference is rejected, not rewritten', async () => {
    const r = await parseTreatmentsFile(csvFile('Title,Risk IDs\nDeploy EDR,"rsk-001;RSK-002"\n'), [], risks);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ row: 2, field: 'Risk ID', message: '"rsk-001" does not exist. A risk "RSK-001" exists; IDs must match exactly.' }]);
  });

  it('requires a title and existing risks, and validates status', async () => {
    const csv = 'Title,Risk ID,Status\n,RSK-001,\nX,RSK-404,\nY,RSK-001,Done\n';
    const r = await parseTreatmentsFile(csvFile(csv), [], risks);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toEqual([
      { row: 2, field: 'Title', message: 'Title is required' },
      { row: 3, field: 'Risk ID', message: 'No risk "RSK-404" exists — import the risk first' },
      { row: 4, field: 'Status', message: 'must be: Open, In Progress, Completed' },
    ]);
  });

  // S2 (create-only): was "updates an existing treatment by id". The update
  // content / submittedAt assertions are retired with the operation (design §9.2 #6).
  it('a non-blank Treatment ID (even an existing one) blocks the file; nothing is updated', async () => {
    const csv = 'Treatment ID,Title,Risk ID\nTRT-003,New title,RSK-002\n';
    const r = await parseTreatmentsFile(csvFile(csv), [existingTreatment('TRT-003')], risks);
    expect(r.rows).toEqual([]);
    expect(r.updated).toBe(0);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Treatment ID']]);
    expect(r.errors[0].message).toMatch(CREATE_ONLY);
  });

  // D9 (decision D5-2): unresolved known defect. Spec: src/test/defects/rcsaImport.ts.
  knownDefect('an exported overdue treatment imports with its stored status', treatmentOverdueRoundTripDefect());
});

// ── Risk export → import (create-only) ──────────────────────────────────────
// Since ID integrity S2 an export cannot be re-imported as-is (its ID column is
// filled); with the ID column cleared it is imported as NEW records. D5 specs
// (identity in the invariant, scores compared without IDs) live in
// src/test/defects/rcsaImport.ts.
describe('Risk export → import (create-only)', () => {
  it('the unmodified export is blocked by its filled Risk ID column', async () => {
    const original = risk('RSK-001', { threat: 'DDoS' });
    const r = await parseRisksFile(csvFile(await captureRiskExport([original], ROUND_TRIP_ASSETS)), [original], ROUND_TRIP_ASSETS);
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'Risk ID']]);
    expect(r.errors[0].message).toMatch(CREATE_ONLY);
  });

  it('fixture: the export with its ID column cleared is a clean create of one NEW risk', async () => {
    const original = risk('RSK-001', { threat: 'DDoS' });
    const csv = withIdColumnCleared(await captureRiskExport([original], ROUND_TRIP_ASSETS), 'Risk ID');
    const r = await parseRisksFile(csvFile(csv), [original], ROUND_TRIP_ASSETS);
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ updated: 0, created: 1, skipped: 0 });
    expect(r.rows.map((x) => [x.id, x.assetIds])).toEqual([['RSK-002', ['AST-001']]]);
  });

  knownDefect('a risk copied through export and import keeps its inherent and residual scores', roundTripScoresDefect());

  knownDefect('a value the exporter armours against formula injection imports back unchanged', roundTripApostropheDefect());
});
