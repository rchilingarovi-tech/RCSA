// Spec-driven CSV import/export for the standalone modules.
// ONE column spec per module drives BOTH directions, so "export → edit in
// Excel → import back" round-trips cleanly. Import is validated row by row
// (RCSA-importer style): bad rows are skipped and reported, good rows land.
// Blank cells on update rows mean "keep the existing value".
import { downloadCsv } from './csv';
import { today } from '../domain/scoring';

export interface RowError {
  row: number; // 1-based spreadsheet row (header = row 1)
  field: string;
  message: string;
}

export interface ImportResult<T> {
  rows: T[];
  created: number;
  updated: number;
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

// ── Minimal RFC-4180 parser (quoted fields, escaped quotes, embedded newlines) ─
function parseCsvCells(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
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
  const cells = parseCsvCells(text);
  const result: ImportResult<T> = { rows: [], created: 0, updated: 0, errors: [], skipped: 0, totalDataRows: 0 };
  if (cells.length === 0) return result;

  // Match each spec column to a header index (case/space tolerant, aliases).
  const headers = cells[0].map((h) => norm(h));
  const idxOf = (c: Col<T>): number => {
    const names = [c.header, ...(c.aliases ?? [])].map(norm);
    return headers.findIndex((h) => names.includes(h));
  };
  const colIdx = new Map<Col<T>, number>();
  spec.cols.forEach((c) => { const i = idxOf(c); if (i !== -1) colIdx.set(c, i); });

  const idCol = spec.cols.find((c) => norm(c.header) === 'id');
  const idIdx = idCol ? (colIdx.get(idCol) ?? -1) : -1;

  const byId = new Map(existing.map((x) => [x.id.toUpperCase(), x]));
  const used = new Set(existing.map((x) => x.id));
  let maxN = 0;
  const re = new RegExp(`^${spec.idPrefix}-(\\d+)$`, 'i');
  used.forEach((id) => { const m = id.match(re); if (m) maxN = Math.max(maxN, Number(m[1])); });
  const nextId = (): string => {
    do { maxN += 1; } while (used.has(`${spec.idPrefix}-${String(maxN).padStart(spec.pad, '0')}`));
    const id = `${spec.idPrefix}-${String(maxN).padStart(spec.pad, '0')}`;
    used.add(id);
    return id;
  };

  for (let r = 1; r < cells.length; r++) {
    const line = cells[r];
    if (line.every((c) => c.trim() === '')) continue;
    result.totalDataRows += 1;
    const rowNum = r + 1;

    const idRaw = idIdx !== -1 ? (line[idIdx] ?? '').trim() : '';
    const prev = idRaw ? byId.get(idRaw.toUpperCase()) : undefined;

    const rowErrors: RowError[] = [];
    const draft: Partial<T> = {};
    for (const c of spec.cols) {
      if (!c.apply || norm(c.header) === 'id') continue;
      const i = colIdx.get(c);
      const raw = i == null ? '' : unarmor((line[i] ?? '').trim());
      if (raw === '') {
        // Blank = keep previous value on updates; only NEW rows need required cells.
        if (c.required && !prev) rowErrors.push({ row: rowNum, field: c.header, message: `${c.header} is required` });
        continue;
      }
      c.apply(raw, draft, (message) => rowErrors.push({ row: rowNum, field: c.header, message }));
    }

    if (rowErrors.length) {
      result.errors.push(...rowErrors);
      result.skipped += 1;
      continue;
    }

    const id = prev ? prev.id : idRaw && !used.has(idRaw) ? (used.add(idRaw), idRaw) : nextId();
    result.rows.push(spec.build({ ...(draft as Partial<T>), id }, prev));
    if (prev) result.updated += 1;
    else result.created += 1;
  }

  return result;
}
