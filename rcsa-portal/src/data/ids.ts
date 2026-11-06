// Shared, safe record-ID allocation (ID integrity stage S1, docs/ID_INTEGRITY_DESIGN.md).
//
// Every automatic ID in the platform is allocated here: the RCSA create forms
// (via genId), createLocalRepo.nextId (11 modules) and both CSV importers.
//
// Policy:
//  • Existing IDs are opaque strings and are never changed.
//  • Only CANONICAL IDs — exact `<PREFIX>-<1..9 digits>` — are read for numbering.
//    Anything else (lowercase, other prefixes, extra separators, oversized
//    numbers) is ignored for numbering but still counts as TAKEN.
//  • "Taken" is compared case-insensitively, so a new ID can never differ from
//    an existing one only by letter case.
//  • next = (highest canonical number) + 1, skipping any taken candidate.
//    Arithmetic stays ≤ 999,999,999 (well inside safe integers) and progress is
//    guaranteed: candidates strictly increase, so at most |taken| + 1 are tried.
//  • If no number ≤ 999,999,999 is free, allocation FAILS with an
//    IdAllocationError — it never loops and never returns a taken ID.
//
// Not in this stage: IDs freed by deleting the highest record can be reissued
// (no persisted high-water mark yet — stage S5).

export const MAX_ID_NUMBER = 999_999_999;

export class IdAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IdAllocationError';
  }
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Incremental allocator for one collection — built ONCE from the taken ids,
 * then updated as ids are reserved or allocated. Use it for batches (CSV
 * imports) so allocation stays linear; memory-only (not a persisted counter).
 */
export interface IdAllocator {
  /** Allocate the next free id and mark it taken. Throws IdAllocationError at the limit. */
  next(): string;
  /** Mark an id as taken (e.g. an explicit id accepted from an import row). */
  reserve(id: string): void;
}

export function createIdAllocator(prefix: string, taken: Iterable<string>, pad = 3): IdAllocator {
  const canonical = new RegExp(`^${escapeRegExp(prefix)}-(\\d{1,9})$`);
  const takenFolded = new Set<string>();
  let max = 0;

  const reserve = (raw: string): void => {
    const id = String(raw);
    takenFolded.add(id.toUpperCase());
    const m = canonical.exec(id);
    if (m) {
      const n = Number(m[1]); // ≤ 9 digits: exact
      if (n > max) max = n;
    }
  };
  for (const raw of taken) reserve(raw);

  return {
    reserve,
    next(): string {
      // Candidates strictly increase from max + 1; only ids already in
      // takenFolded can block one, so at most takenFolded.size + 1 are tried —
      // and never beyond MAX_ID_NUMBER.
      for (let n = max + 1; n <= MAX_ID_NUMBER; n += 1) {
        const candidate = `${prefix}-${String(n).padStart(pad, '0')}`;
        if (!takenFolded.has(candidate.toUpperCase())) {
          reserve(candidate);
          return candidate;
        }
      }
      throw new IdAllocationError(
        `Cannot allocate a new ${prefix} ID: the numbering limit (${prefix}-${MAX_ID_NUMBER}) has been reached. ` +
          'No record was saved.',
      );
    },
  };
}

/** Allocate the next free `<prefix>-<number>` ID, zero-padded to `pad` digits. */
export function allocateId(prefix: string, taken: Iterable<string>, pad = 3): string {
  return createIdAllocator(prefix, taken, pad).next();
}

/** Message to show a user when allocation fails. */
export function idAllocationMessage(err: unknown): string {
  return err instanceof IdAllocationError ? err.message : `Could not allocate a record ID: ${err instanceof Error ? err.message : String(err)}`;
}

/**
 * For create forms: run `allocate`; on failure report a readable message and
 * return null so the caller can stop WITHOUT saving (the form stays open with
 * the values entered).
 */
export function allocateOrReport(allocate: () => string, report: (message: string) => void): string | null {
  try {
    return allocate();
  } catch (err) {
    report(idAllocationMessage(err));
    return null;
  }
}
