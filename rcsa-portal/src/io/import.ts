import type {
  Asset,
  Risk,
  Treatment,
  CIA,
  Score5,
  YesNo,
  DataClass,
  AssetStatus,
  Assessment,
  TreatmentStatus,
} from '../data/models';
import {
  DATA_CLASSES,
  ASSET_STATUSES,
  ASSESSMENTS,
  TREATMENT_STATUSES,
  THREAT_CATALOGUE,
} from '../domain/constants';
import { today } from '../domain/scoring';
import { idAllocationMessage } from '../data/ids';
import { buildParentIndex, createVariantSafeAllocator, parseReferenceCell, showId, type ParentIndex, type ReferenceLabels } from '../data/importIds';

// ── Spreadsheet import (.csv) ───────────────────────────────────────────────────
// Parses a CSV file into validated Asset[] / Risk[] / Treatment[]. No third-party
// parser (the previous `xlsx` dependency was dropped — it carried known CVEs). Pure
// aside from file I/O: no store/repo access — the caller commits the result.
//
// ID integrity S2 (docs/ID_INTEGRITY_S2_DESIGN.md): CSV import is CREATE-ONLY.
// Every record gets a new ID from the shared allocator; a non-blank value in any
// ID column blocks the file. References to parents are exact and fail closed.
// Any error anywhere blocks the import (the UI enables Import only with zero errors).

export interface RowError {
  row: number; // 1-based spreadsheet row (matches what the user sees, header = row 1)
  field: string;
  message: string;
}

export interface ImportResult<T> {
  rows: T[]; // valid NEW entities (preview); committed only when errors is empty
  created: number; // rows that will be created
  updated: number; // always 0: CSV import is create-only (kept for type compatibility)
  errors: RowError[];
  skipped: number; // rows with errors
  totalDataRows: number;
}

type Raw = Record<string, unknown>;

// Normalize a header/key for case- and space-insensitive lookup.
const norm = (s: string): string => s.toLowerCase().replace(/[\s_]+/g, ' ').trim();

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

interface SheetLine {
  raw: Raw; // header-keyed object — NON-identity columns only (via field())
  cells: string[]; // the raw, untrimmed cells — identity columns are read from these
}
type Sheet = { ok: true; headers: string[]; lines: SheetLine[] } | { ok: false; error: RowError };

/** Read a CSV file: strict parse, header row, non-blank data lines. */
async function readSheet(file: File): Promise<Sheet> {
  const parsed = parseCsvStrict(await file.text());
  if (!parsed.ok) return { ok: false, error: { row: parsed.row, field: 'File', message: parsed.message } };
  const cells = parsed.rows;
  if (cells.length === 0) return { ok: true, headers: [], lines: [] };
  const headers = cells[0].map((h) => h.trim());
  const lines: SheetLine[] = [];
  for (let r = 1; r < cells.length; r++) {
    const line = cells[r];
    if (line.every((c) => c.trim() === '')) continue; // skip blank lines
    const obj: Raw = {};
    headers.forEach((h, idx) => { obj[h] = line[idx] ?? ''; });
    lines.push({ raw: obj, cells: line });
  }
  return { ok: true, headers, lines };
}

function fileErrorResult<T>(error: RowError): ImportResult<T> {
  return { rows: [], created: 0, updated: 0, errors: [error], skipped: 0, totalDataRows: 0 };
}

/** Indices of EVERY header matching one of the aliases (duplicates included). */
function columnsMatching(headers: string[], aliases: string[]): number[] {
  const names = aliases.map(norm);
  const out: number[] = [];
  headers.forEach((h, idx) => { if (names.includes(norm(h))) out.push(idx); });
  return out;
}

/** §3.1 rule 2: at most one reference column; otherwise a file error. */
function singleReferenceColumn(headers: string[], aliases: string[], parent: string): { col: number | null; error?: RowError } {
  const cols = columnsMatching(headers, aliases);
  if (cols.length <= 1) return { col: cols[0] ?? null };
  const list = cols.map((c) => `"${headers[c]}" in column ${c + 1}`).join(', ');
  return {
    col: null,
    error: { row: 1, field: 'File', message: `The file has more than one ${parent}-reference column (${list}). Keep exactly one.` },
  };
}

/**
 * §3.1 rules 1 and 4, on the raw cells: a non-blank value in ANY row-ID column
 * (duplicates and aliases included) blocks the row; so does a non-blank cell
 * that has no heading (often an unquoted comma).
 */
function identityCellErrors(cells: string[], headers: string[], idCols: number[], rowNum: number): RowError[] {
  const out: RowError[] = [];
  cells.forEach((c, k) => {
    if (c.trim() !== '' && (k >= headers.length || headers[k] === '')) {
      out.push({
        row: rowNum,
        field: `Column ${k + 1}`,
        message: `Row ${rowNum} has a value in column ${k + 1}, which has no heading. This is often an unquoted comma; put the cell in quotes.`,
      });
    }
  });
  for (const k of idCols) {
    const v = cells[k] ?? '';
    if (v.trim() !== '') {
      out.push({
        row: rowNum,
        field: headers[k],
        message:
          `CSV import creates new records only, and IDs are assigned automatically. This file has a value in the ${headers[k]} column ("${showId(v.trim())}"). ` +
          'If it is an export, importing it would create duplicates. Clear the ID column to import the rows as new records, or edit existing records in their forms.',
      });
    }
  }
  return out;
}

/** Resolve one reference cell (raw, untrimmed) against the parent index. */
function resolveReferences(
  cells: string[],
  refCol: number | null,
  index: ParentIndex,
  labels: ReferenceLabels,
  bad: (field: string, message: string) => void,
): string[] {
  const rawCell = refCol === null ? '' : (cells[refCol] ?? '');
  const { ids, problems } = parseReferenceCell(rawCell, index, labels);
  problems.forEach((p) => bad(labels.column, p));
  if (ids.length === 0 && problems.length === 0) bad(labels.column, `At least one ${labels.column} is required`);
  return ids;
}

/** Build a normalized-key accessor for one row, tolerant of header aliases. */
function field(raw: Raw) {
  const map = new Map<string, unknown>();
  for (const k of Object.keys(raw)) map.set(norm(k), raw[k]);
  return (...aliases: string[]): string => {
    for (const a of aliases) {
      const v = map.get(norm(a));
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  };
}

function isRowEmpty(raw: Raw): boolean {
  return Object.values(raw).every((v) => v === null || v === undefined || String(v).trim() === '');
}

// ── coercion helpers ───────────────────────────────────────────────────────────

function matchEnum<T extends string>(value: string, allowed: readonly T[]): T | null {
  if (!value) return null;
  const hit = allowed.find((a) => norm(a) === norm(value));
  return hit ?? null;
}

function parseYesNo(value: string): YesNo | null {
  if (!value) return null;
  const v = norm(value);
  if (['yes', 'y', 'true', '1'].includes(v)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(v)) return 'No';
  return null;
}

function parseIntInRange(value: string, min: number, max: number): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** Split a "a; b; c" cell into a trimmed list. */
function parseList(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}


/** §3.4: new IDs from the shared allocator; an allocation failure is a row error. */
function allocateFor(
  allocator: { next(): string },
  bad: (field: string, message: string) => void,
  field: string,
): string {
  try {
    return allocator.next();
  } catch (err) {
    bad(field, idAllocationMessage(err));
    return '';
  }
}

// ── Assets ───────────────────────────────────────────────────────────────────

const ASSET_ID_ALIASES = ['Asset ID', 'ID'];

export async function parseAssetsFile(file: File, existing: Asset[]): Promise<ImportResult<Asset>> {
  const sheet = await readSheet(file);
  if (!sheet.ok) return fileErrorResult(sheet.error);
  const { headers, lines } = sheet;
  const errors: RowError[] = [];
  const rows: Asset[] = [];
  let skipped = 0;
  let totalDataRows = 0;

  const idCols = columnsMatching(headers, ASSET_ID_ALIASES);
  const ids = createVariantSafeAllocator('AST', existing.map((a) => a.id), 3);

  lines.forEach(({ raw, cells }, i) => {
    const rowNum = i + 2; // +1 header, +1 to 1-base
    const rowErrors: RowError[] = identityCellErrors(cells, headers, idCols, rowNum);
    if (rowErrors.length === 0 && isRowEmpty(raw)) return;
    totalDataRows += 1;
    const get = field(raw);
    const bad = (f: string, m: string) => rowErrors.push({ row: rowNum, field: f, message: m });

    const name = get('Name', 'Asset Name');
    if (!name) bad('Name', 'Name is required');

    const enumOr = <T extends string>(label: string, val: string, allowed: readonly T[], dflt: T): T => {
      if (!val) return dflt;
      const m = matchEnum(val, allowed);
      if (!m) bad(label, `"${val}" is not one of: ${allowed.join(', ')}`);
      return m ?? dflt;
    };
    const ciaOr = (label: string, val: string): CIA => {
      if (!val) return 1;
      const n = parseIntInRange(val, 1, 3);
      if (n === null) bad(label, `"${val}" must be 1, 2 or 3`);
      return (n ?? 1) as CIA;
    };
    const yesNoOr = (label: string, val: string): YesNo => {
      if (!val) return 'No';
      const yn = parseYesNo(val);
      if (yn === null) bad(label, `"${val}" must be Yes or No`);
      return yn ?? 'No';
    };

    const c = ciaOr('C', get('C', 'Confidentiality'));
    const iv = ciaOr('I', get('I', 'Integrity'));
    const a = ciaOr('A', get('A', 'Availability'));
    const dataClass = enumOr<DataClass>('Data Class', get('Data Class'), DATA_CLASSES, 'Internal');
    const status = enumOr<AssetStatus>('Status', get('Status'), ASSET_STATUSES, 'Draft');

    // Rows that already failed validation allocate no id.
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }
    const id = allocateFor(ids, bad, 'Asset ID');
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    rows.push({
      id,
      name,
      process: get('Process'),
      department: get('Department'),
      busOwner: get('Business Owner', 'Bus Owner'),
      itOwner: get('IT Owner'),
      applicantName: get('Applicant', 'Applicant Name'),
      c,
      i: iv,
      a,
      dataClass,
      pci: yesNoOr('PCI', get('PCI')),
      criticalProcess: yesNoOr('Critical Process', get('Critical Process')),
      internet: yesNoOr('Internet Facing', get('Internet Facing', 'Internet')),
      thirdParty: yesNoOr('Third Party', get('Third Party')),
      cloud: yesNoOr('Cloud', get('Cloud')),
      status,
      reviewDate: get('Review Date'),
      evidence: parseList(get('Evidence')),
      notes: get('Notes'),
      submittedAt: get('Submitted At') || today(),
    });
  });

  return { rows, created: rows.length, updated: 0, errors, skipped, totalDataRows };
}

// ── Risks ──────────────────────────────────────────────────────────────────────

const RISK_ID_ALIASES = ['Risk ID', 'ID'];
const RISK_ASSET_REF_ALIASES = ['Asset ID'];

export async function parseRisksFile(
  file: File,
  existingRisks: Risk[],
  assets: Asset[],
): Promise<ImportResult<Risk>> {
  const sheet = await readSheet(file);
  if (!sheet.ok) return fileErrorResult(sheet.error);
  const { headers, lines } = sheet;
  const ref = singleReferenceColumn(headers, RISK_ASSET_REF_ALIASES, 'asset');
  if (ref.error) return fileErrorResult(ref.error);
  const errors: RowError[] = [];
  const rows: Risk[] = [];
  let skipped = 0;
  let totalDataRows = 0;

  const idCols = columnsMatching(headers, RISK_ID_ALIASES);
  const assetIndex = buildParentIndex(assets.map((a) => a.id));
  const ids = createVariantSafeAllocator('RSK', existingRisks.map((r) => r.id), 3);

  lines.forEach(({ raw, cells }, i) => {
    const rowNum = i + 2;
    const rowErrors: RowError[] = identityCellErrors(cells, headers, idCols, rowNum);
    if (rowErrors.length === 0 && isRowEmpty(raw)) return;
    totalDataRows += 1;
    const get = field(raw);
    const bad = (f: string, m: string) => rowErrors.push({ row: rowNum, field: f, message: m });

    // One risk may apply to several assets: a list in ONE reference cell,
    // separated by ; , or newlines. Every asset must exist exactly (§3.3).
    const resolvedAssetIds = resolveReferences(cells, ref.col, assetIndex, { parent: 'asset', column: 'Asset ID' }, bad);

    const threat = get('Threat');
    if (!threat) bad('Threat', 'Threat is required');

    const score5 = (label: string, val: string): Score5 => {
      if (!val) return 1;
      const n = parseIntInRange(val, 1, 5);
      if (n === null) bad(label, `"${val}" must be 1–5`);
      return (n ?? 1) as Score5;
    };
    // Residual is optional: a blank cell means "not assessed" (no default).
    const score5opt = (label: string, val: string): Score5 | undefined => {
      if (!val) return undefined;
      const n = parseIntInRange(val, 1, 5);
      if (n === null) { bad(label, `"${val}" must be 1–5`); return undefined; }
      return n as Score5;
    };
    const assessment =
      (matchEnum<Assessment>(get('Decision', 'Assessment'), ASSESSMENTS) as Assessment | null) ??
      (get('Decision', 'Assessment') ? (bad('Decision', `must be: ${ASSESSMENTS.join(', ')}`), 'Mitigate') : 'Mitigate');

    // Rows that already failed validation allocate no id.
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }
    const id = allocateFor(ids, bad, 'Risk ID');
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    rows.push({
      id,
      assetIds: resolvedAssetIds,
      threat,
      customThreat: !THREAT_CATALOGUE.some((t) => norm(t) === norm(threat)),
      vuln: get('Vulnerability', 'Vuln'),
      owner: get('Owner'),
      impact: score5('Impact', get('Impact')),
      likelihood: score5('Likelihood', get('Likelihood')),
      resImpact: score5opt('Residual Impact', get('Residual Impact', 'Res Impact')),
      resLikelihood: score5opt('Residual Likelihood', get('Residual Likelihood', 'Res Likelihood')),
      assessment,
      controls: parseList(get('Controls')),
      acceptanceExpiry: get('Acceptance Expiry'),
      evidence: parseList(get('Evidence')),
      comments: parseList(get('Comments')),
      submittedAt: get('Submitted At') || today(),
    });
  });

  return { rows, created: rows.length, updated: 0, errors, skipped, totalDataRows };
}

// ── Treatments ───────────────────────────────────────────────────────────────

const TREATMENT_ID_ALIASES = ['Treatment ID', 'ID'];
const TREATMENT_RISK_REF_ALIASES = ['Risk ID', 'Risk IDs'];

export async function parseTreatmentsFile(
  file: File,
  existingTreatments: Treatment[],
  risks: Risk[],
): Promise<ImportResult<Treatment>> {
  const sheet = await readSheet(file);
  if (!sheet.ok) return fileErrorResult(sheet.error);
  const { headers, lines } = sheet;
  const ref = singleReferenceColumn(headers, TREATMENT_RISK_REF_ALIASES, 'risk');
  if (ref.error) return fileErrorResult(ref.error);
  const errors: RowError[] = [];
  const rows: Treatment[] = [];
  let skipped = 0;
  let totalDataRows = 0;

  const idCols = columnsMatching(headers, TREATMENT_ID_ALIASES);
  const riskIndex = buildParentIndex(risks.map((r) => r.id));
  const ids = createVariantSafeAllocator('TRT', existingTreatments.map((t) => t.id), 3);

  lines.forEach(({ raw, cells }, i) => {
    const rowNum = i + 2;
    const rowErrors: RowError[] = identityCellErrors(cells, headers, idCols, rowNum);
    if (rowErrors.length === 0 && isRowEmpty(raw)) return;
    totalDataRows += 1;
    const get = field(raw);
    const bad = (f: string, m: string) => rowErrors.push({ row: rowNum, field: f, message: m });

    const title = get('Title');
    if (!title) bad('Title', 'Title is required');

    // One treatment can address several risks: a list in ONE reference cell (§3.3).
    const resolved = resolveReferences(cells, ref.col, riskIndex, { parent: 'risk', column: 'Risk ID' }, bad);

    const status =
      (matchEnum<TreatmentStatus>(get('Status'), TREATMENT_STATUSES) as TreatmentStatus | null) ??
      (get('Status') ? (bad('Status', `must be: ${TREATMENT_STATUSES.join(', ')}`), 'Open') : 'Open');

    // Rows that already failed validation allocate no id.
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }
    const id = allocateFor(ids, bad, 'Treatment ID');
    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    rows.push({
      id,
      riskIds: resolved,
      title,
      description: get('Description', 'Action Plan'),
      owner: get('Owner'),
      dueDate: get('Due Date', 'Deadline'),
      status,
      evidence: parseList(get('Evidence')),
      comments: parseList(get('Comments')),
      submittedAt: get('Submitted At') || today(),
    });
  });

  return { rows, created: rows.length, updated: 0, errors, skipped, totalDataRows };
}
