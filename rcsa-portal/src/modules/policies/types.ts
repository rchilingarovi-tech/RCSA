// Policy & Document Control — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference.

export const DOC_TYPES = ['Policy', 'Standard', 'Procedure', 'Guideline'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = ['Draft', 'In Review', 'Approved', 'Retired'] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface PolicyDoc {
  id: string; // POL-##
  title: string;
  type: DocType;
  version: string;
  status: DocStatus;
  owner: string;
  nextReview: string; // YYYY-MM-DD or ''
}

export const statusToken: Record<DocStatus, string> = { Approved: 'low', 'In Review': 'med', Draft: 'mut', Retired: 'mut' };
export const typeToken: Record<DocType, string> = { Policy: 'info', Standard: 'purple', Procedure: 'ok', Guideline: 'mut' };

/** Days until review (negative = overdue); null when no review date set. */
export function daysToReview(nextReview: string): number | null {
  if (!nextReview) return null;
  return Math.round((new Date(nextReview).getTime() - Date.now()) / 86400000);
}

/** A retired doc is never "due"; otherwise overdue (<0) or soon (≤60d). Used by the header bell. */
export function reviewDue(d: PolicyDoc): boolean {
  if (d.status === 'Retired') return false;
  const dl = daysToReview(d.nextReview);
  return dl !== null && dl <= 60;
}
