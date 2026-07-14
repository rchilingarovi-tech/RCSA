// Audit & Regulator Findings — standalone module. Own model + storage.
// Tracks findings raised by regulator inspections (NBG), internal audit,
// external audit and self-assessments, each with a remediation owner + deadline.
import { today } from '../../domain/scoring';

export const FINDING_SOURCES = ['NBG Inspection', 'Internal Audit', 'External Audit', 'Self-identified'] as const;
export type FindingSource = (typeof FINDING_SOURCES)[number];

export const FINDING_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = ['Open', 'In Progress', 'Submitted for Closure', 'Closed'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export interface Finding {
  id: string; // FND-##
  title: string;
  source: FindingSource;
  ref: string; // report reference, e.g. "NBG-2026-11" / "IA-2026-04"
  severity: FindingSeverity;
  owner: string; // remediation owner
  dueDate: string; // YYYY-MM-DD remediation deadline
  status: FindingStatus;
  description: string; // finding detail (redacted from audit-trail diffs)
  actionPlan: string; // remediation plan (redacted from audit-trail diffs)
}

export const severityTone: Record<FindingSeverity, string> = { Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' };
export const statusTone: Record<FindingStatus, string> = { Open: 'high', 'In Progress': 'info', 'Submitted for Closure': 'med', Closed: 'low' };
export const sourceTone: Record<FindingSource, string> = { 'NBG Inspection': 'crit', 'Internal Audit': 'info', 'External Audit': 'purple', 'Self-identified': 'mut' };

export const isOpenFinding = (f: Pick<Finding, 'status'>): boolean => f.status !== 'Closed';

/** Overdue = not closed and past the remediation deadline. Also used by the bell. */
export function overdue(f: Pick<Finding, 'status' | 'dueDate'>): boolean {
  return isOpenFinding(f) && !!f.dueDate && f.dueDate < today();
}

/** Whole days past the deadline (0 when not overdue). */
export function overdueDays(f: Pick<Finding, 'status' | 'dueDate'>): number {
  if (!overdue(f)) return 0;
  return Math.max(0, Math.round((new Date(today()).getTime() - new Date(f.dueDate).getTime()) / 86400000));
}
