// Characterization tests for the spec-driven CSV importer used by the standalone
// registers (lib/tableIo.ts), exercised through a real module spec (Vendors).
import { describe, expect, it } from 'vitest';
import { importCsvText, parseEnum, parseList, parseNumIn } from './tableIo';
import { vendorIo } from '../modules/vendors/io';
import type { Vendor } from '../modules/vendors/types';

const vendor = (id: string, over: Partial<Vendor> = {}): Vendor => ({
  id, name: `Vendor ${id}`, criticality: 'High', dataAccess: 'Confidential', score: 40,
  contractExpiry: '2027-01-01', certs: ['ISO 27001'], ...over,
});

describe('coercion helpers', () => {
  it('parseEnum matches case/space-insensitively', () => {
    expect(parseEnum('  high ', ['Critical', 'High'] as const)).toBe('High');
    expect(parseEnum('severe', ['Critical', 'High'] as const)).toBeNull();
  });
  it('parseNumIn accepts finite numbers in range only', () => {
    expect(parseNumIn('42.5', 0, 100)).toBe(42.5);
    expect(parseNumIn('101', 0, 100)).toBeNull();
    expect(parseNumIn('abc', 0, 100)).toBeNull();
  });
  it('parseList splits on ; and newlines', () => {
    expect(parseList('a; b\nc;;')).toEqual(['a', 'b', 'c']);
  });
});

describe('importCsvText (Vendor spec)', () => {
  it('imports a new row with typed fields', () => {
    const csv = 'ID,Name,Criticality,Data access,Residual score,Contract expiry,Certifications\n,Acme,critical,restricted,72,2027-06-30,ISO 27001; SOC 2\n';
    const r = importCsvText(vendorIo, csv, []);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{
      id: 'VEN-01', name: 'Acme', criticality: 'Critical', dataAccess: 'Restricted', score: 72,
      contractExpiry: '2027-06-30', certs: ['ISO 27001', 'SOC 2'],
    }]);
    expect(r.created).toBe(1);
  });

  it('accepts header aliases and ignores export-only computed columns', () => {
    const csv = 'Vendor ID,Name,Score,Band,Certs\n,Acme,10,Critical,PCI-DSS\n';
    const r = importCsvText(vendorIo, csv, []);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ score: 10, certs: ['PCI-DSS'] });
  });

  // S2 (create-only): was "requires Name on NEW rows only". Every row is new now,
  // so Name is required on every row; the explicit VEN-03 row is blocked (design §9.2 #8).
  it('requires Name on every row (all rows are new); an explicit ID row is blocked', () => {
    const r = importCsvText(vendorIo, 'ID,Name,Residual score\n,,50\nVEN-03,,60\n,Acme,70\n', [vendor('VEN-03')]);
    expect(r.errors).toEqual([
      { row: 2, field: 'Name', message: 'Name is required' },
      { row: 3, field: 'ID', message: expect.stringMatching(/creates new records only/) },
      { row: 3, field: 'Name', message: 'Name is required' },
    ]);
    expect(r.rows.map((v) => [v.id, v.name])).toEqual([['VEN-04', 'Acme']]);
    expect(r.updated).toBe(0);
  });

  // S2 (create-only): was "blank cells on an update keep the existing values".
  // The update operation and its blank-keeps rule are retired (design §9.2 #9).
  it('a non-blank ID (exact or case variant of a stored ID) blocks the row; nothing is updated', () => {
    const r = importCsvText(vendorIo, 'ID,Name\nven-03,X\nVEN-03,Y\n', [vendor('VEN-03')]);
    expect(r.rows).toEqual([]);
    expect(r.updated).toBe(0);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[2, 'ID'], [3, 'ID']]);
  });

  it('reports invalid enum and out-of-range values with the row number', () => {
    const r = importCsvText(vendorIo, 'Name,Criticality,Residual score\nA,Severe,10\nB,Low,150\n', []);
    expect(r.rows).toHaveLength(0);
    expect(r.skipped).toBe(2);
    expect(r.errors).toEqual([
      { row: 2, field: 'Criticality', message: '"Severe" must be: Critical, High, Medium, Low' },
      { row: 3, field: 'Residual score', message: '"150" must be 0–100' },
    ]);
  });

  it('strips the apostrophe the exporter adds against formula injection', () => {
    const r = importCsvText(vendorIo, "Name\n'=HYPERLINK(1)\n", []);
    expect(r.rows[0].name).toBe('=HYPERLINK(1)');
  });

  // S2 (create-only): the explicit VEN-20 row of the old fixture is now a row
  // error; allocation after the highest number is unchanged (design §9.2 #10).
  it('allocates ids after the highest existing number', () => {
    const existing = [vendor('VEN-01'), vendor('VEN-09')];
    const r = importCsvText(vendorIo, 'ID,Name\n,A\n,C\n', existing);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((v) => v.id)).toEqual(['VEN-10', 'VEN-11']);
  });

  it('an explicit new ID (VEN-20) is rejected, not reserved', () => {
    const r = importCsvText(vendorIo, 'ID,Name\n,A\nVEN-20,B\n,C\n', [vendor('VEN-01'), vendor('VEN-09')]);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([[3, 'ID']]);
    expect(r.rows.map((v) => v.id)).toEqual(['VEN-10', 'VEN-11']);
  });

  it('handles quoted fields, BOM, CRLF and blank lines', () => {
    const csv = '﻿Name,Certifications\r\n"Acme, Inc.","ISO 27001;\nSOC 2"\r\n\r\n';
    const r = importCsvText(vendorIo, csv, []);
    expect(r.totalDataRows).toBe(1);
    expect(r.rows[0]).toMatchObject({ name: 'Acme, Inc.', certs: ['ISO 27001', 'SOC 2'] });
  });

  it('returns an empty result for empty input', () => {
    expect(importCsvText(vendorIo, '', [])).toEqual({ rows: [], created: 0, updated: 0, errors: [], skipped: 0, totalDataRows: 0 });
  });
});
