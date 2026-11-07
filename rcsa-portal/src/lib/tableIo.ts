// Spec-driven CSV import/export for the standalone modules.
// ONE column spec per module drives BOTH directions.
//
// ID integrity S2 (docs/ID_INTEGRITY_S2_DESIGN.md): import is CREATE-ONLY.
// Every row becomes a new record with an ID from the shared allocator; a
// non-blank value in any ID column (aliases and duplicate headers included)
// blocks the file. Any error anywhere blocks the import (the UI enables Import
// only with zero errors). Exported files therefore cannot be re-imported as-is.
import { downloadCsv } from './csv';
import { today } from '../domain/scoring';
import { idAllocationMessage } from '../data/ids';
import { createVariantSafeAllocator, showId } from '../data/importIds';

export interface RowError {
  row: number; // 1-based spreadsheet row (header = row 1)
  field: string;
  message: string;
}

export interface ImportResult<T> {
  rows: T[]; // valid NEW records (preview); committed only when errors is empty
  created: number;
  updated: number; // always 0: create-only (kept for type compatibility)
  errors: RowError[];
  skipped: number;
  totalDataRows: number;
}

export interface Col<T> {
  header: string;
  aliases?: string[];
  /** Import: reject NEW rows where this cell is blank. */
  required?: boolean;
  /** Export accessor. */
  value: (item: T) => string | number;
  /** Import parser — omit for export-only (computed) columns. */
  apply?: (raw: string, draft: Partial<T>, bad: (message: string) => void) => void;
}

export interface IoSpec<T extends { id: string }> {
  entity: string; // "Vendor"
  filePrefix: string; // vendors-YYYY-MM-DD.csv
  idPrefix: string; // VEN
  pad: number;
  cols: Col<T>[];
  /** Finalize a parsed draft (id already set): fill from prev / defaults. */
  build: (draft: Partial<T> & { id: string }, prev: T | undefined) => T;
}

// ── Shared coercion helpers for module specs ─────────────────────────────────
const norm = (s: string): string => s.toLowerCase().replace(/[\s_%]+/g, ' ').trim();

export function parseEnum<E extends string>(raw: string, allowed: readonly E[]): E | null {
  const hit = allowed.find((a) => norm(a) === norm(raw));
  return hit ?? null;
}

export function parseNumIn(raw: string, min: number, max: number): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

export function parseList(raw: string): string[] {
  return raw.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
}

// ── Strict CSV grammar (ID integrity S2 §3.2; identical in io/import.ts and lib/tableIo.ts) ─
// RFC-4180 with fail-closed rules: a quote may only open a field (after optional
// spaces/tabs); "" is a literal quote; after a closing quote only spaces/tabs and
// then , / LF / CRLF / end of file may follow; an unclosed quote, a quote inside
// an unquoted value and a bare CR are FILE errors — no cell is silently altered.
// Quoted fields keep commas, LF and CR literally. The BOM is stripped.
type CsvParse =
  | { ok: true; rows: string[][] }
  | { ok: false; row: number; message: string };

function showCell(value: string): string {
  const s = value.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  return s.length > 40 ? `${s.slice(0, 37)}…` : s;
}

function parseCsvStrict(input: string): CsvParse {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  const n = text.length;
  if (n === 0) return { ok: true, rows };
  let row: string[] = [];
  let record = 1; // CSV record number = spreadsheet row (header = 1)
  let i = 0;
  const fail = (rowNo: number, message: string): CsvParse => ({ ok: false, row: rowNo, message });
  const bareCr = (rowNo: number): CsvParse =>
    fail(rowNo, `Row ${rowNo}: the file contains a carriage return outside quotes. Save it again as CSV UTF-8.`);

  for (;;) {
    const column = row.length + 1;
    // Field start: optional spaces/tabs before an opening quote are tolerated.
    let j = i;
    while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
    let value = '';
    if (j < n && text[j] === '"') {
      const startRecord = record;
      j++;
      for (;;) {
        if (j >= n) return fail(startRecord, `Row ${startRecord}, column ${column}: unclosed quote. Quote the whole value and double any quote inside it.`);
        const ch = text[j];
        if (ch === '"') {
          if (text[j + 1] === '"') { value += '"'; j += 2; continue; }
          j++;
          break;
        }
        value += ch;
        j++;
      }
      while (j < n && (text[j] === ' ' || text[j] === '\t')) j++;
      if (j < n && text[j] === '\r' && text[j + 1] !== '\n') return bareCr(record);
      if (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r') {
        return fail(record, `Row ${record}, column ${column}: characters after a closing quote ("${showCell(value)}"). Quote the whole value and double any quote inside it.`);
      }
    } else {
      j = i;
      while (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r') {
        if (text[j] === '"') {
          let end = j;
          while (end < n && text[end] !== ',' && text[end] !== '\n' && text[end] !== '\r') end++;
          return fail(record, `Row ${record}, column ${column}: a quote character inside an unquoted value (${showCell(text.slice(i, end))}). Quote the whole value and double the inner quotes.`);
        }
        j++;
      }
      value = text.slice(i, j);
      if (j < n && text[j] === '\r' && text[j + 1] !== '\n') return bareCr(record);
    }
    row.push(value);
    if (j >= n) { rows.push(row); break; }
    if (text[j] === ',') { i = j + 1; continue; }
    // End of record: LF or CRLF.
    i = text[j] === '\r' ? j + 2 : j + 1;
    rows.push(row);
    row = [];
    record += 1;
    if (i >= n) break;
  }
  return { ok: true, rows };
}

/** Strip the '-prefix the exporter adds to neutralize formula injection. */
const unarmor = (s: string): string => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

// ── Export ────────────────────────────────────────────────────────────────────
export function exportRows<T extends { id: string }>(spec: IoSpec<T>, rows: T[]): void {
  downloadCsv(
    `${spec.filePrefix}-${today()}.csv`,
    spec.cols.map((c) => c.header),
    rows.map((r) => spec.cols.map((c) => c.value(r))),
  );
}

// ── Import ────────────────────────────────────────────────────────────────────
export function importCsvText<T extends { id: string }>(
  spec: IoSpec<T>,
  text: string,
  existing: T[],
): ImportResult<T> {
  const result: ImportResult<T> = { rows: [], created: 0, updated: 0, errors: [], skipped: 0, totalDataRows: 0 };
  const parsed = parseCsvStrict(text);
  if (!parsed.ok) {
    result.errors.push({ row: parsed.row, field: 'File', message: parsed.message });
    return result;
  }
  const cells = parsed.rows;
  if (cells.length === 0) return result;

  // Match each NON-identity spec column to a header index (case/space tolerant, aliases).
  const rawHeaders = cells[0].map((h) => h.trim());
  const headers = rawHeaders.map((h) => norm(h));
  const idxOf = (c: Col<T>): number => {
    const names = [c.header, ...(c.aliases ?? [])].map(norm);
    return headers.findIndex((h) => names.includes(h));
  };
  const isIdCol = (c: Col<T>) => norm(c.header) === 'id';
  const colIdx = new Map<Col<T>, number>();
  spec.cols.forEach((c) => { if (isIdCol(c)) return; const i = idxOf(c); if (i !== -1) colIdx.set(c, i); });

  // Identity: EVERY header matching the ID column or one of its aliases
  // (duplicates included), read from the raw cells — never via findIndex (§3.1).
  const idCol = spec.cols.find(isIdCol);
  const idNames = idCol ? [idCol.header, ...(idCol.aliases ?? [])].map(norm) : [];
  const idIdxs: number[] = [];
  headers.forEach((h, k) => { if (idNames.includes(h)) idIdxs.push(k); });

  // Shared safe allocator (data/ids.ts) + the S2 variant skip (data/importIds.ts).
  const allocator = createVariantSafeAllocator(spec.idPrefix, existing.map((x) => x.id), spec.pad);

  for (let r = 1; r < cells.length; r++) {
    const line = cells[r];
    if (line.every((c) => c.trim() === '')) continue;
    result.totalDataRows += 1;
    const rowNum = r + 1;

    const rowErrors: RowError[] = [];
    // §3.1 rule 4: a non-blank cell with no heading (often an unquoted comma).
    line.forEach((c, k) => {
      if (c.trim() !== '' && (k >= rawHeaders.length || rawHeaders[k] === '')) {
        rowErrors.push({
          row: rowNum,
          field: `Column ${k + 1}`,
          message: `Row ${rowNum} has a value in column ${k + 1}, which has no heading. This is often an unquoted comma; put the cell in quotes.`,
        });
      }
    });
    // §3.1 rule 1 (B-1): any non-blank ID cell blocks the row.
    for (const k of idIdxs) {
      const v = line[k] ?? '';
      if (v.trim() !== '') {
        rowErrors.push({
          row: rowNum,
          field: rawHeaders[k],
          message:
            `CSV import creates new records only, and IDs are assigned automatically. This file has a value in the ${rawHeaders[k]} column ("${showId(v.trim())}"). ` +
            'If it is an export, importing it would create duplicates. Clear the ID column to import the rows as new records, or edit existing records in their forms.',
        });
      }
    }

    const draft: Partial<T> = {};
    for (const c of spec.cols) {
      if (!c.apply || isIdCol(c)) continue;
      const i = colIdx.get(c);
      const raw = i == null ? '' : unarmor((line[i] ?? '').trim());
      if (raw === '') {
        // Every row is new (create-only), so required cells are required on every row.
        if (c.required) rowErrors.push({ row: rowNum, field: c.header, message: `${c.header} is required` });
        continue;
      }
      c.apply(raw, draft, (message) => rowErrors.push({ row: rowNum, field: c.header, message }));
    }

    // Rows that already failed validation allocate no id.
    if (rowErrors.length) {
      result.errors.push(...rowErrors);
      result.skipped += 1;
      continue;
    }

    let id: string;
    try {
      id = allocator.next();
    } catch (err) {
      result.errors.push({ row: rowNum, field: 'ID', message: idAllocationMessage(err) });
      result.skipped += 1;
      continue;
    }
    result.rows.push(spec.build({ ...(draft as Partial<T>), id }, undefined));
    result.created += 1;
  }

  return result;
}
