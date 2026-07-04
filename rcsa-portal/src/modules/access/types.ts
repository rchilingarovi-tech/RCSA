// Access Reviews — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference (state derived from progress + due).

export interface AccessReview {
  id: string; // ACR-##
  campaign: string;
  scope: string;
  period: string; // e.g. "2026-Q2"
  reviewer: string;
  due: string; // YYYY-MM-DD
  progress: number; // 0–100
}

/** Overdue = not yet complete and past the due date. Also used by the header bell. */
export function overdue(r: AccessReview): boolean {
  return r.progress < 100 && !!r.due && new Date(r.due).getTime() < Date.now();
}
