// ID integrity S2 — Step 2: the create-only import persistence core.
// Design: docs/ID_INTEGRITY_S2_DESIGN.md §4.1–§4.3 and §4.6 (revision 6.1).
//
// Phase 1 reads RAW values with localStorage.getItem only — never a repository
// list()/read(), seed, migration or normalisation — and refuses the whole
// operation, with ZERO writes, on any finding:
//   • storage unavailable; target missing / unreadable / malformed;
//   • an allocated ID (or a case / padding / whitespace variant of it) now taken;
//   • B-3: a referenced parent no longer passes the four §3.3 step 5 checks
//     against the parent index rebuilt from the RAW stored parent IDs.
// Phase 2 appends by splicing the stored TEXT, so every existing record stays
// byte-identical (legacy fields included), then writes ONCE with an unswallowed
// setItem and a read-back. The outcome is reported honestly as rejected,
// verified or uncertain. There is NO retry and NO rollback: either could
// duplicate records or overwrite a concurrent change.
//
// Step 3 adds `importNewRecords` (end of this file): the audit pre-flight
// (decision D5-1), the checked audit write and the five §4.5 outcomes. It is
// reached through the repositories' dedicated `importNew` methods only.
import { buildParentIndex, checkResolvedReference, collisionKey, showId, type ReferenceLabels } from './importIds';
import { auditLog, type AuditInput } from '../audit/auditLog';

/** localStorage key of the audit log (audit/auditLog.ts). */
export const AUDIT_KEY = 'infosec.audit.v1';

export interface ImportTarget {
  /** localStorage key of the collection being imported into, e.g. "rcsa.assets.v1". */
  key: string;
  /** Display name, e.g. "Assets". */
  label: string;
  /** Message when the key is missing (default: "The stored <label> collection is missing …"). */
  missingMessage?: string;
}

export interface ImportParent<T> {
  /** localStorage key of the parent collection, e.g. "rcsa.assets.v1" for risk imports. */
  key: string;
  /** Display name of the parent collection, e.g. "assets". */
  label: string;
  /** Labels used by the §3.3 checks ("asset" / "Asset ID"). */
  labels: ReferenceLabels;
  /** The references each new row holds, already resolved at preview. */
  refsOf: (row: T) => string[];
}

export type DataWriteResult =
  /** Phase 1 refused, or setItem threw and the stored value is provably unchanged. Nothing was written. */
  | { status: 'rejected'; reasons: string[] }
  /** The read-back equals exactly what was written. `records` is the stored array, parsed from it. */
  | { status: 'verified'; written: number; records: unknown[] }
  /** The write may or may not have happened. Never retried, never rolled back. */
  | { status: 'uncertain'; reason: string };

export type ReadForImport =
  | { status: 'ok'; records: unknown[] }
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'unavailable' };

const UNAVAILABLE = 'Browser storage is not available. Nothing was imported.';

type RawRead = { ok: true; raw: string | null } | { ok: false };

function rawGet(key: string): RawRead {
  try {
    return { ok: true, raw: localStorage.getItem(key) };
  } catch {
    return { ok: false };
  }
}

/** Parse a stored collection: a JSON array whose every element is an object with a string id. */
function parseCollection(raw: string): { ok: true; records: Record<string, unknown>[] } | { ok: false } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(parsed)) return { ok: false };
  for (const el of parsed) {
    if (el === null || typeof el !== 'object' || Array.isArray(el) || typeof (el as { id?: unknown }).id !== 'string') {
      return { ok: false };
    }
  }
  return { ok: true, records: parsed as Record<string, unknown>[] };
}

/**
 * §4.6 read-only refresh source: raw getItem + parse, no seeding, migration or
 * normalisation. (Step 3 wires it into the store / pages.)
 */
export function readForImport(key: string): ReadForImport {
  const r = rawGet(key);
  if (!r.ok) return { status: 'unavailable' };
  if (r.raw === null) return { status: 'missing' };
  // Same validation as the commit's own Phase 1 (parseCollection): a JSON array
  // whose every entry is a non-null object with a string id. Anything else —
  // e.g. [null] or an entry without an id — is "unreadable", so callers keep
  // their previous state instead of adopting malformed records (Codex S2
  // step 3 review). Only validated records ever reach display adapters.
  const parsed = parseCollection(r.raw);
  return parsed.ok ? { status: 'ok', records: parsed.records } : { status: 'unreadable' };
}

/**
 * Commit validated NEW rows (from the Step 1 parsers) to one collection:
 * Phase 1 checks with zero writes, then one checked, append-only write.
 */
export function commitNewRecords<T extends { id: string }>(opts: {
  target: ImportTarget;
  rows: T[];
  parent?: ImportParent<T>;
}): DataWriteResult {
  const { target, rows, parent } = opts;
  const reject = (...reasons: string[]): DataWriteResult => ({ status: 'rejected', reasons });

  // ── Phase 1: raw reads and checks — no writes on any path below ──────────
  if (rows.length === 0) return reject('There are no records to import. Nothing was imported.');

  const targetRead = rawGet(target.key);
  if (!targetRead.ok) return reject(UNAVAILABLE);
  const raw = targetRead.raw;
  if (raw === null) {
    return reject(target.missingMessage ?? `The stored ${target.label} collection is missing; it was removed after the preview. Nothing was imported.`);
  }
  const current = parseCollection(raw);
  if (!current.ok) return reject(`The stored ${target.label} data is unreadable. Nothing was imported.`);

  const reasons: string[] = [];

  // Allocated IDs: still free, exactly and by collision key; distinct within the batch.
  const storedKeys = new Set(current.records.map((r) => collisionKey(r.id as string)));
  const batchKeys = new Set<string>();
  for (const row of rows) {
    if (typeof row.id !== 'string' || row.id === '') {
      reasons.push('Internal error: a record to import has no ID. Nothing was imported.');
      continue;
    }
    const key = collisionKey(row.id);
    if (batchKeys.has(key)) reasons.push(`Internal error: ${showId(row.id)} appears twice in this import. Nothing was imported.`);
    batchKeys.add(key);
    if (storedKeys.has(key)) {
      reasons.push(`${showId(row.id)} (or a variant of it) was created after the preview. Choose the file again to get new IDs.`);
    }
  }

  // B-3: rebuild the parent index from the RAW stored parent IDs and re-run the
  // four §3.3 step 5 checks on every already-resolved reference.
  if (parent) {
    const parentRead = rawGet(parent.key);
    if (!parentRead.ok) return reject(UNAVAILABLE);
    const parentRecords = parentRead.raw === null ? null : parseCollection(parentRead.raw);
    if (parentRecords === null || !parentRecords.ok) {
      return reject(`The stored ${parent.label} cannot be read, so the links cannot be verified. Nothing was imported.`);
    }
    const index = buildParentIndex(parentRecords.records.map((r) => r.id as string));
    for (const row of rows) {
      for (const ref of parent.refsOf(row)) {
        const problem = checkResolvedReference(ref, index, parent.labels);
        if (problem) {
          reasons.push(`${showId(row.id)}: the linked ${parent.labels.parent} "${showId(ref)}" changed after the preview. ${problem}`);
        }
      }
    }
  }

  if (reasons.length > 0) return reject(...reasons);

  // ── Phase 2: append by splicing the stored text (existing bytes untouched) ─
  const appended = rows.map((r) => JSON.stringify(r));
  let next: string;
  if (current.records.length === 0) {
    next = `[${appended.join(',')}]`;
  } else {
    const j = raw.lastIndexOf(']');
    next = `${raw.slice(0, j)},${appended.join(',')}${raw.slice(j)}`;
  }
  // Guard before writing: the spliced text must parse to exactly old + new.
  try {
    const check: unknown = JSON.parse(next);
    const ok =
      Array.isArray(check) &&
      check.length === current.records.length + rows.length &&
      check.slice(0, current.records.length).every((el, i) => JSON.stringify(el) === JSON.stringify(current.records[i])) &&
      check.slice(current.records.length).every((el, i) => JSON.stringify(el) === appended[i]);
    if (!ok) return reject('Internal error: the records could not be appended safely. Nothing was imported.');
  } catch {
    return reject('Internal error: the records could not be appended safely. Nothing was imported.');
  }

  // One write, not swallowed; then a read-back. No retry, no rollback.
  let writeThrew = false;
  try {
    localStorage.setItem(target.key, next);
  } catch {
    writeThrew = true;
  }
  let readBack: string | null;
  try {
    readBack = localStorage.getItem(target.key);
  } catch {
    return { status: 'uncertain', reason: 'The saved data could not be read back, so it is unknown whether the import was saved.' };
  }
  if (writeThrew) {
    if (readBack === raw) return reject('Saving failed (browser storage is full or unavailable). Nothing was imported.');
    return { status: 'uncertain', reason: 'Saving reported an error and the stored data changed, so it is unknown whether the import was saved.' };
  }
  if (readBack !== next) {
    return { status: 'uncertain', reason: 'The stored data read back differs from what was written, so it is unknown whether the import was saved.' };
  }
  return { status: 'verified', written: rows.length, records: JSON.parse(next) as unknown[] };
}

// ═════════════════════════════════════════════════════════════════════════════
// Step 3 — audit pre-flight, checked audit write and the five outcomes (§4.4–§4.6)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The five §4.5 outcomes. Data and audit are two separate writes: an audit
 * failure after a verified data write is reported, never rolled back, and never
 * described as atomic. Nothing is retried.
 */
export type ImportOutcome =
  /** Phase 1 finding (incl. the audit pre-flight) or data not written. Nothing changed. */
  | { kind: 'rejected'; reasons: string[] }
  /** Data verified and every audit event recorded. */
  | { kind: 'committed'; count: number; records: unknown[] }
  /** Data verified; the audit write provably did not happen. */
  | { kind: 'committed-audit-not-recorded'; count: number; records: unknown[]; listenerErrors: number }
  /** Data verified; the audit write may or may not have happened. */
  | { kind: 'committed-audit-uncertain'; count: number; records: unknown[]; listenerErrors: number }
  /** The data write may or may not have happened. No audit attempted. `refresh` is a read-only re-read. */
  | { kind: 'uncertain'; reason: string; refresh: ReadForImport };

/**
 * D5-1 audit pre-flight (§4.2): refuse BEFORE any data write when the audit log
 * cannot be read, or is present but not a JSON array — so an import is never
 * knowingly left unaudited. A missing audit key is fine (an empty log).
 */
export function auditPreflight(): string | null {
  const r = rawGet(AUDIT_KEY);
  if (!r.ok) return UNAVAILABLE;
  if (r.raw === null) return null;
  try {
    if (Array.isArray(JSON.parse(r.raw))) return null;
  } catch {
    /* fall through */
  }
  return 'The audit log is unreadable, so this import could not be recorded. Nothing was imported.';
}

/**
 * The full create-only import: audit pre-flight → Phase 1 checks → one checked
 * data write → (only if verified) one checked audit batch. Returns one of the
 * five outcomes; `records` / `refresh` come from storage read-backs only.
 */
export function importNewRecords<T extends { id: string }>(opts: {
  target: ImportTarget;
  rows: T[];
  parent?: ImportParent<T>;
  /** The audit events for the written rows (same events as today's saves / bulkSave). */
  auditEvents: (rows: T[]) => AuditInput[];
}): ImportOutcome {
  const preflight = auditPreflight();
  if (preflight) return { kind: 'rejected', reasons: [preflight] };

  const data = commitNewRecords({ target: opts.target, rows: opts.rows, parent: opts.parent });
  if (data.status === 'rejected') return { kind: 'rejected', reasons: data.reasons };
  if (data.status === 'uncertain') return { kind: 'uncertain', reason: data.reason, refresh: readForImport(opts.target.key) };

  const audit = auditLog.recordBatchChecked(opts.auditEvents(opts.rows));
  if (audit.status === 'recorded') return { kind: 'committed', count: data.written, records: data.records };
  if (audit.status === 'not-recorded') {
    return { kind: 'committed-audit-not-recorded', count: data.written, records: data.records, listenerErrors: audit.listenerErrors };
  }
  return { kind: 'committed-audit-uncertain', count: data.written, records: data.records, listenerErrors: audit.listenerErrors };
}

/**
 * §4.5 user messages. `noun` is the plural display name ("assets"). For
 * UNCERTAIN, a refresh that could not be read adds the §4.6 warning. No message
 * tells the user to reload (a reload can seed or migrate, F23).
 */
export function outcomeMessage(outcome: ImportOutcome, noun: string): string {
  switch (outcome.kind) {
    case 'rejected':
      return outcome.reasons.join(' ');
    case 'committed':
      return `Imported ${outcome.count} new ${noun}.`;
    case 'committed-audit-not-recorded':
      return `${outcome.count} new ${noun} were imported, but the audit log could not be updated. No audit events were recorded for this import.`;
    case 'committed-audit-uncertain':
      return `${outcome.count} new ${noun} were imported. The audit log may not have been updated; check the Audit Log.`;
    case 'uncertain':
      return outcome.refresh.status === 'ok'
        ? 'The import may or may not have been saved. The list now shows what is stored; check it before importing again.'
        : 'The import may or may not have been saved, and the stored data could not be read back. Reloading the app would replace missing data with demo data.';
  }
}
