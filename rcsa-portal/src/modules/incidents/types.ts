// Incidents — standalone module. Own model + storage. InfoSec / cyber incident
// tracking. Model ported from the SentinelGRC reference.

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const INCIDENT_STATUSES = ['Open', 'Investigating', 'Contained', 'Closed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const CATEGORIES = ['Phishing', 'Malware', 'Data Leak', 'Access Misuse', 'DDoS', 'Other'] as const;
export type IncidentCategory = (typeof CATEGORIES)[number];

export interface Incident {
  id: string; // INC-###
  title: string;
  severity: Severity;
  status: IncidentStatus;
  category: IncidentCategory;
  categoryOther: string; // used when category === 'Other'
  rootCause: string;
  corrective: string;
  opened: string; // YYYY-MM-DD
  closed: string; // YYYY-MM-DD or '' (still open)
}

export const severityToken: Record<Severity, string> = { Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' };
export const statusToken: Record<IncidentStatus, string> = { Open: 'crit', Investigating: 'high', Contained: 'med', Closed: 'low' };

export const isActive = (i: Incident) => i.status !== 'Closed';

/** Effective category label — folds "Other" into its specified value. */
export const categoryLabel = (i: Incident) => (i.category === 'Other' ? i.categoryOther || 'Other' : i.category);

/** Days from opened to closed, or null while still open. */
export function timeToCloseDays(i: Incident): number | null {
  if (!i.closed || !i.opened) return null;
  const d = Math.round((new Date(i.closed).getTime() - new Date(i.opened).getTime()) / 86400000);
  return d >= 0 ? d : 0;
}
