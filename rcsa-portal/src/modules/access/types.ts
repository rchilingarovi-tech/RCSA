// Access Reviews — standalone module. Own model + storage.

export const SCOPES = ['System', 'Application', 'Infrastructure', 'Data'] as const;
export type Scope = (typeof SCOPES)[number];

export const REVIEW_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface AccessReview {
  id: string; // ACR-###
  name: string;
  scope: Scope;
  period: string; // e.g. "2026 Q2"
  reviewer: string;
  due: string; // YYYY-MM-DD
  status: ReviewStatus;
  progress: number; // 0–100
}

export function statusColor(s: ReviewStatus): string {
  return s === 'Completed' ? 'low' : s === 'In Progress' ? 'info' : 'mut';
}

/** Overdue = past due and not yet completed. */
export function overdue(r: AccessReview): boolean {
  if (r.status === 'Completed' || !r.due) return false;
  return new Date(r.due).getTime() < Date.now();
}
