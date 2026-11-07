// ID integrity S2 — pure identity rules for CSV imports (create-only).
// Design: docs/ID_INTEGRITY_S2_DESIGN.md §3.1–§3.4 (revision 6.1).
//
// • collisionKey — DETECTION ONLY (case, surrounding whitespace, zero-padding);
//   never used to select or rewrite a record.
// • buildParentIndex / parseReferenceCell — exact, fail-closed parent references
//   (Risk → Asset, Treatment → Risk). The armor check runs BEFORE any trailing
//   whitespace is removed, so trim() cannot erase the exporter's marker.
// • createVariantSafeAllocator — wraps the unchanged S1 allocator so a new ID
//   never collides with a stored case/padding variant.
// No storage access, no side effects.
import { createIdAllocator } from './ids';

/** Detection-only key: trim + upper-case + numeric padding folded (string-based). */
export function collisionKey(id: string): string {
  const u = id.trim().toUpperCase();
  const m = /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(u);
  if (m) return `${m[1]}#${m[2].replace(/^0+/, '') || '0'}`;
  return u;
}

/** The exporter's formula-injection armor: an apostrophe before = + - @ tab CR. */
export const ARMORED = /^'[=+\-@\t\r]/;

/** Reference-list separators plus CR: an ID containing one cannot be carried in a list cell. */
const DELIMITER_CHARS = /[;,\r\n]/;
/** Separators used to split a reference cell (unchanged from the pre-S2 importer). */
const REFERENCE_SPLIT = /[;,\n]/;

export function isDelimiterBearing(id: string): boolean {
  return DELIMITER_CHARS.test(id);
}

export interface ParentIndex {
  exact: Set<string>;
  groups: Map<string, string[]>;
  delimiterBearing: Set<string>;
  splitTokens: Set<string>;
  /** Some stored parent ID is empty after trim() (only spaces / control characters). */
  hasBlankLike: boolean;
}

export function buildParentIndex(ids: Iterable<string>): ParentIndex {
  const exact = new Set<string>();
  const groups = new Map<string, string[]>();
  const delimiterBearing = new Set<string>();
  const splitTokens = new Set<string>();
  let hasBlankLike = false;
  // Every RAW record is counted — identical IDs are NOT deduplicated — so two
  // stored records with exactly the same ID form an ambiguous group (Codex S2
  // step 2 review). Callers pass one ID per stored record.
  for (const id of ids) {
    exact.add(id);
    const key = collisionKey(id);
    const g = groups.get(key);
    if (g) g.push(id);
    else groups.set(key, [id]);
    if (id.trim() === '') hasBlankLike = true;
    if (isDelimiterBearing(id)) {
      delimiterBearing.add(id);
      for (const part of id.split(DELIMITER_CHARS)) {
        const t = part.trim();
        if (t) splitTokens.add(collisionKey(t));
      }
    }
  }
  return { exact, groups, delimiterBearing, splitTokens, hasBlankLike };
}

/** Show a value in a message: control characters escaped, long values shortened. */
export function showId(value: string): string {
  const escaped = value.replace(/\t/g, '\\t').replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  return escaped.length > 60 ? `${escaped.slice(0, 57)}…` : escaped;
}

export interface ReferenceLabels {
  /** "asset" / "risk" — the parent entity, lower case. */
  parent: string;
  /** The reference column's display name, e.g. "Asset ID". */
  column: string;
}

/**
 * The §3.3 step 5 acceptance checks for one already-trimmed item. Returns null
 * when the item is an exact, unambiguous parent ID; otherwise the reason.
 * (Step 2 of the S2 plan reuses this for the commit-time B-3 revalidation.)
 */
export function checkResolvedReference(id: string, index: ParentIndex, labels: ReferenceLabels): string | null {
  const key = collisionKey(id);
  if (!index.exact.has(id)) {
    const variants = index.groups.get(key);
    if (variants && variants.length > 0) {
      const article = /^[aeiou]/i.test(labels.parent) ? 'An' : 'A';
      return `"${showId(id)}" does not exist. ${article} ${labels.parent} "${showId(variants[0])}" exists; IDs must match exactly.`;
    }
    return `No ${labels.parent} "${showId(id)}" exists — import the ${labels.parent} first`;
  }
  if (index.delimiterBearing.has(id)) {
    return `Stored ${labels.parent} ID "${showId(id)}" contains a list separator and cannot be referenced from CSV. Link it in the form.`;
  }
  const group = index.groups.get(key) ?? [];
  if (group.length > 1) {
    if (group.every((g) => g === id)) {
      return `"${showId(id)}" is ambiguous: ${group.length} stored ${labels.parent}s have exactly this ID. Link it in the form.`;
    }
    return `"${showId(id)}" is ambiguous: stored ${labels.parent}s ${group.map((g) => `"${showId(g)}"`).join(' and ')} differ only in case, spacing or zero-padding. Link it in the form.`;
  }
  if (index.splitTokens.has(key)) {
    const holder = [...index.delimiterBearing].find((d) => d.split(DELIMITER_CHARS).some((p) => p.trim() && collisionKey(p.trim()) === key));
    return `"${showId(id)}" is ambiguous: stored ${labels.parent} "${showId(holder ?? '')}" contains a list separator, so this cell may refer to it. Link it in the form.`;
  }
  return null;
}

/**
 * §3.3 reference cell. `rawCell` must be the UNTRIMMED cell exactly as parsed.
 * Order (revision 6.1): split → armor check on trimStart() (before any trailing
 * trim) → blank-like items → trim() → step 5 checks. Accepted IDs are returned
 * exactly as written, exact duplicates dropped; every problem is reported.
 */
export function parseReferenceCell(
  rawCell: string,
  index: ParentIndex,
  labels: ReferenceLabels,
): { ids: string[]; problems: string[] } {
  const problems: string[] = [];
  const ids: string[] = [];
  const keyToItem = new Map<string, string>();
  let blankLikeReported = false;

  for (const item of rawCell.split(REFERENCE_SPLIT)) {
    // Step 2: armor check before trailing whitespace is removed.
    const lead = item.trimStart();
    if (ARMORED.test(lead)) {
      problems.push(`"${showId(lead)}" starts with an apostrophe added by CSV export; the intended ID cannot be determined. Link it in the form.`);
      continue;
    }
    // Step 3: blank-like items.
    if (item.trim() === '') {
      if (index.hasBlankLike && !blankLikeReported) {
        problems.push(`An empty list entry may refer to a stored ${labels.parent} whose ID is only spaces or control characters. Link it in the form.`);
        blankLikeReported = true;
      }
      continue;
    }
    // Step 4: trim.
    const t = item.trim();
    // Two different spellings of one key in the same cell are ambiguous.
    const key = collisionKey(t);
    const seen = keyToItem.get(key);
    if (seen !== undefined && seen !== t) {
      problems.push(`"${showId(seen)}" and "${showId(t)}" in one ${labels.column} cell differ only in case, spacing or zero-padding.`);
      continue;
    }
    keyToItem.set(key, t);
    if (ids.includes(t)) continue; // exact duplicate: dropped, as before S2
    // Step 5: acceptance checks.
    const problem = checkResolvedReference(t, index, labels);
    if (problem) problems.push(problem);
    else ids.push(t);
  }
  return { ids, problems };
}

/**
 * The unchanged S1 allocator, plus §3.4's variant skip: a candidate whose
 * collision key matches a stored ID is discarded and the next one taken.
 * Bounded by the number of stored keys (each skipped candidate matches a
 * distinct stored ID). Throws IdAllocationError at the numbering limit (S1).
 */
export function createVariantSafeAllocator(prefix: string, existingIds: Iterable<string>, pad: number): { next(): string } {
  const stored = [...existingIds];
  const storedKeys = new Set(stored.map(collisionKey));
  const allocator = createIdAllocator(prefix, stored, pad);
  return {
    next(): string {
      for (;;) {
        const id = allocator.next();
        if (!storedKeys.has(collisionKey(id))) return id;
      }
    },
  };
}
