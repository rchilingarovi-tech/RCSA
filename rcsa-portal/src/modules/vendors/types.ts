// Third-Party Vendors — standalone module (not linked to RCSA). Own model + storage.

export const CRITICALITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const VENDOR_STATUSES = ['Active', 'Offboarded'] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export interface AssessmentEntry {
  date: string;
  note: string;
}

export interface Vendor {
  id: string; // VEN-###
  name: string;
  category: string;
  criticality: Criticality;
  dataAccess: boolean;
  score: number; // residual risk score 0–100 (higher = riskier)
  expiry: string; // contract expiry YYYY-MM-DD
  assessed: string; // last assessed YYYY-MM-DD
  status: VendorStatus;
  certs: string[];
  sla: string;
  pentest: string;
  bcp: string;
  dataNote: string;
  history: AssessmentEntry[];
}

/** Risk band from score. k maps to a status colour token (low/med/high/crit). */
export function band(score: number): { label: string; k: string } {
  if (score <= 25) return { label: 'Low', k: 'low' };
  if (score <= 45) return { label: 'Medium', k: 'med' };
  if (score <= 70) return { label: 'High', k: 'high' };
  return { label: 'Critical', k: 'crit' };
}

export function criticalityColor(c: Criticality): string {
  return c === 'Critical' ? 'crit' : c === 'High' ? 'high' : c === 'Medium' ? 'med' : 'low';
}

/** Days until contract expiry (negative = already expired). */
export function daysLeft(expiry: string): number {
  return Math.round((new Date(expiry).getTime() - Date.now()) / 86400000);
}
