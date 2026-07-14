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

// ── Spreadsheet import (.csv) ───────────────────────────────────────────────────
// Parses a CSV file into validated Asset[] / Risk[]. No third-party parser (the
// previous `xlsx` dependency was dropped — it carried known CVEs). Pure aside from
// file I/O: no store/repo access — the caller commits the result. Round-trips with
// the CSV export (computed columns like Value/Criticality/Score are ignored).

export interface RowError {
  row: number; // 1-based spreadsheet row (matches what the user sees, header = row 1)
  field: string;
  message: string;
}

export interface ImportResult<T> {
  rows: T[]; // valid, fully-typed entities ready to upsert
  created: number; // rows with a new id
  updated: number; // rows whose id matches an existing entity
  errors: RowError[];
  skipped: number; // rows dropped due to errors
  totalDataRows: number;
}

type Raw = Record<string, unknown>;

// Normalize a header/key for case- and space-insensitive lookup.
const norm = (s: string): string => s.toLowerCase().replace(/[\s_]+/g, ' ').trim();

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes (""),
 * and commas / newlines inside quotes. Returns rows of string cells.
 */
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
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Read a CSV file into header-keyed row objects (first row = headers). */
async function readRows(file: File): Promise<Raw[]> {
  const cells = parseCsvCells(await file.text());
  if (cells.length === 0) return [];
  const headers = cells[0].map((h) => h.trim());
  const out: Raw[] = [];
  for (let r = 1; r < cells.length; r++) {
    const line = cells[r];
    if (line.every((c) => c.trim() === '')) continue; // skip blank lines
    const obj: Raw = {};
    headers.forEach((h, idx) => { obj[h] = line[idx] ?? ''; });
    out.push(obj);
  }
  return out;
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

/** Allocate the next free `PREFIX-000` id, honouring ids already taken this batch. */
function makeIdAllocator(prefix: string, used: Set<string>) {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const id of used) {
    const m = id.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return (): string => {
    max += 1;
    let id = `${prefix}-${String(max).padStart(3, '0')}`;
    while (used.has(id)) {
      max += 1;
      id = `${prefix}-${String(max).padStart(3, '0')}`;
    }
    used.add(id);
    return id;
  };
}

// ── Assets ───────────────────────────────────────────────────────────────────

export async function parseAssetsFile(file: File, existing: Asset[]): Promise<ImportResult<Asset>> {
  const raws = await readRows(file);
  const errors: RowError[] = [];
  const rows: Asset[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalDataRows = 0;

  const byId = new Map(existing.map((a) => [a.id.toUpperCase(), a]));
  const usedIds = new Set(existing.map((a) => a.id));
  const nextId = makeIdAllocator('AST', usedIds);

  raws.forEach((raw, i) => {
    if (isRowEmpty(raw)) return;
    totalDataRows += 1;
    const rowNum = i + 2; // +1 header, +1 to 1-base
    const get = field(raw);
    const rowErrors: RowError[] = [];
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

    // Resolve id: explicit id updates the matching asset; otherwise allocate.
    const givenId = get('Asset ID', 'ID');
    let id: string;
    let isUpdate = false;
    if (givenId) {
      const match = byId.get(givenId.toUpperCase());
      if (match) {
        id = match.id;
        isUpdate = true;
      } else if (usedIds.has(givenId)) {
        id = nextId(); // collides with a row already taken this batch
      } else {
        id = givenId;
        usedIds.add(givenId);
      }
    } else {
      id = nextId();
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    const prev = isUpdate ? byId.get(givenId.toUpperCase()) : undefined;
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
      submittedAt: get('Submitted At') || prev?.submittedAt || today(),
    });
    if (isUpdate) updated += 1;
    else created += 1;
  });

  return { rows, created, updated, errors, skipped, totalDataRows };
}

// ── Risks ──────────────────────────────────────────────────────────────────────

export async function parseRisksFile(
  file: File,
  existingRisks: Risk[],
  assets: Asset[],
): Promise<ImportResult<Risk>> {
  const raws = await readRows(file);
  const errors: RowError[] = [];
  const rows: Risk[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalDataRows = 0;

  const riskById = new Map(existingRisks.map((r) => [r.id.toUpperCase(), r]));
  const assetIds = new Set(assets.map((a) => a.id.toUpperCase()));
  const usedIds = new Set(existingRisks.map((r) => r.id));
  const nextId = makeIdAllocator('RSK', usedIds);

  raws.forEach((raw, i) => {
    if (isRowEmpty(raw)) return;
    totalDataRows += 1;
    const rowNum = i + 2;
    const get = field(raw);
    const rowErrors: RowError[] = [];
    const bad = (f: string, m: string) => rowErrors.push({ row: rowNum, field: f, message: m });

    // One risk may apply to several assets — accept a list in the cell, separated
    // by ; , or newlines. Every referenced asset must already exist.
    const assetIdRaw = get('Asset ID');
    const requestedAssetIds = assetIdRaw.split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
    if (requestedAssetIds.length === 0) {
      bad('Asset ID', 'At least one Asset ID is required');
    }
    const resolvedAssetIds: string[] = [];
    requestedAssetIds.forEach((raw) => {
      if (!assetIds.has(raw.toUpperCase())) {
        bad('Asset ID', `No asset "${raw}" exists — import the asset first`);
        return;
      }
      const canon = assets.find((a) => a.id.toUpperCase() === raw.toUpperCase())!.id;
      if (!resolvedAssetIds.includes(canon)) resolvedAssetIds.push(canon);
    });

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

    const givenId = get('Risk ID', 'ID');
    let id: string;
    let isUpdate = false;
    if (givenId) {
      const match = riskById.get(givenId.toUpperCase());
      if (match) {
        id = match.id;
        isUpdate = true;
      } else if (usedIds.has(givenId)) {
        id = nextId();
      } else {
        id = givenId;
        usedIds.add(givenId);
      }
    } else {
      id = nextId();
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    const prev = isUpdate ? riskById.get(givenId.toUpperCase()) : undefined;
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
      submittedAt: get('Submitted At') || prev?.submittedAt || today(),
    });
    if (isUpdate) updated += 1;
    else created += 1;
  });

  return { rows, created, updated, errors, skipped, totalDataRows };
}

// ── Treatments ───────────────────────────────────────────────────────────────

export async function parseTreatmentsFile(
  file: File,
  existingTreatments: Treatment[],
  risks: Risk[],
): Promise<ImportResult<Treatment>> {
  const raws = await readRows(file);
  const errors: RowError[] = [];
  const rows: Treatment[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let totalDataRows = 0;

  const byId = new Map(existingTreatments.map((t) => [t.id.toUpperCase(), t]));
  const riskIdSet = new Set(risks.map((r) => r.id.toUpperCase()));
  const usedIds = new Set(existingTreatments.map((t) => t.id));
  const nextId = makeIdAllocator('TRT', usedIds);

  raws.forEach((raw, i) => {
    if (isRowEmpty(raw)) return;
    totalDataRows += 1;
    const rowNum = i + 2;
    const get = field(raw);
    const rowErrors: RowError[] = [];
    const bad = (f: string, m: string) => rowErrors.push({ row: rowNum, field: f, message: m });

    const title = get('Title');
    if (!title) bad('Title', 'Title is required');

    // One treatment can address several risks (separated by ; , or newlines).
    const riskRaw = get('Risk ID', 'Risk IDs');
    const requested = riskRaw.split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
    if (requested.length === 0) bad('Risk ID', 'At least one Risk ID is required');
    const resolved: string[] = [];
    requested.forEach((rr) => {
      if (!riskIdSet.has(rr.toUpperCase())) {
        bad('Risk ID', `No risk "${rr}" exists — import the risk first`);
        return;
      }
      const canon = risks.find((r) => r.id.toUpperCase() === rr.toUpperCase())!.id;
      if (!resolved.includes(canon)) resolved.push(canon);
    });

    const status =
      (matchEnum<TreatmentStatus>(get('Status'), TREATMENT_STATUSES) as TreatmentStatus | null) ??
      (get('Status') ? (bad('Status', `must be: ${TREATMENT_STATUSES.join(', ')}`), 'Open') : 'Open');

    const givenId = get('Treatment ID', 'ID');
    let id: string;
    let isUpdate = false;
    if (givenId) {
      const match = byId.get(givenId.toUpperCase());
      if (match) {
        id = match.id;
        isUpdate = true;
      } else if (usedIds.has(givenId)) {
        id = nextId();
      } else {
        id = givenId;
        usedIds.add(givenId);
      }
    } else {
      id = nextId();
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      skipped += 1;
      return;
    }

    const prev = isUpdate ? byId.get(givenId.toUpperCase()) : undefined;
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
      submittedAt: get('Submitted At') || prev?.submittedAt || today(),
    });
    if (isUpdate) updated += 1;
    else created += 1;
  });

  return { rows, created, updated, errors, skipped, totalDataRows };
}
