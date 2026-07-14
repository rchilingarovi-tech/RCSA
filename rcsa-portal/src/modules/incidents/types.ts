// Incidents — standalone module. Own model + storage. InfoSec / cyber incident tracking.

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = ['Open', 'In Progress', 'Pending', 'Closed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const CATEGORIES = [
  'Phishing',
  'Malware',
  'Unauthorized Access',
  'Data Leak',
  'Denial of Service',
  'Physical',
  'Policy Violation',
  'Other',
] as const;
export type IncidentCategory = (typeof CATEGORIES)[number];

export interface Incident {
  id: string; // INC-###
  shortDesc: string;
  reportedAt: string; // ISO datetime (when it was reported)
  occurredAt: string; // ISO datetime (when it actually happened)
  reportedBy: string;
  category: IncidentCategory;
  categoryOther: string; // free-text detail when category === 'Other'
  severity: Severity;
  asset: string; // affected asset / system
  description: string; // full description
  rootCause: string; // post-investigation root cause
  correctiveAction: string; // corrective / remedial action taken
  status: IncidentStatus;
  responsible: string; // responsible person / handler
  closedAt: string; // YYYY-MM-DD, empty until closed
}

/** Display label for a category, expanding 'Other' with its free-text detail. */
export function categoryLabel(i: Pick<Incident, 'category' | 'categoryOther'>): string {
  return i.category === 'Other' && i.categoryOther ? `Other — ${i.categoryOther}` : i.category;
}

export function severityColor(s: Severity): string {
  return s === 'Critical' ? 'crit' : s === 'High' ? 'high' : s === 'Medium' ? 'med' : 'low';
}

export function statusColor(s: IncidentStatus): string {
  // Open = needs attention (amber/high), In Progress = info, Pending = med, Closed = resolved (green/low)
  return s === 'Closed' ? 'low' : s === 'In Progress' ? 'info' : s === 'Pending' ? 'med' : 'high';
}

/** Display label for a status — clarifies the ambiguous 'Pending'. */
export const statusLabel = (s: IncidentStatus): string => (s === 'Pending' ? 'Pending – external' : s);

/** Whole days an incident has been open since it was reported; null when closed
 *  or the date is invalid. Computed per call so long-lived tabs stay accurate. */
export function daysOpen(i: Pick<Incident, 'status' | 'reportedAt'>): number | null {
  if (i.status === 'Closed') return null;
  const start = new Date(i.reportedAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / 86400000));
}

export const SEVERITY_RANK: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export const isOpen = (i: Incident): boolean => i.status !== 'Closed';

// ── Shared filter (drives the dashboard + the list together, RCSA-style) ─────────
export interface IncidentFilter {
  search: string;
  status: string;
  severity: string;
  category: string;
  responsible: string;
  from: string; // reportedAt >= (YYYY-MM-DD)
  to: string; // reportedAt <= (YYYY-MM-DD)
}

export const EMPTY_INCIDENT_FILTER: IncidentFilter = {
  search: '', status: '', severity: '', category: '', responsible: '', from: '', to: '',
};

export function filterIncidents(items: Incident[], f: IncidentFilter): Incident[] {
  const q = f.search.trim().toLowerCase();
  return items.filter((i) => {
    if (f.status && i.status !== f.status) return false;
    if (f.severity && i.severity !== f.severity) return false;
    if (f.category && i.category !== f.category) return false;
    if (f.responsible && i.responsible !== f.responsible) return false;
    if (f.from && i.reportedAt.slice(0, 10) < f.from) return false;
    if (f.to && i.reportedAt.slice(0, 10) > f.to) return false;
    if (q && !`${i.id} ${i.shortDesc}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** Days from report to closure; null when not closed. */
export function timeToClosureDays(i: Incident): number | null {
  if (i.status !== 'Closed' || !i.closedAt) return null;
  const start = new Date(i.reportedAt).getTime();
  const end = new Date(i.closedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 86400000));
}
