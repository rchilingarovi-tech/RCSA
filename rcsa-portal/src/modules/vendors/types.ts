// Third-Party Vendors — standalone module (not linked to RCSA). Own model + storage.
// Model ported from the SentinelGRC reference.

export const CRITICALITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const DATA_ACCESS = ['None', 'Internal', 'Confidential', 'Restricted'] as const;
export type DataAccess = (typeof DATA_ACCESS)[number];

export const CERT_OPTIONS = ['ISO 27001', 'SOC 2', 'PCI-DSS'] as const;

export interface Vendor {
  id: string; // VEN-##
  name: string;
  criticality: Criticality;
  dataAccess: DataAccess;
  score: number; // residual risk 0–100 (lower is better)
  contractExpiry: string; // YYYY-MM-DD
  certs: string[];
}

/** Residual-score band (lower is better). `k` is a status colour token. */
export function scoreBand(score: number): { label: string; k: string } {
  if (score >= 60) return { label: 'Severe', k: 'crit' };
  if (score >= 40) return { label: 'Elevated', k: 'high' };
  if (score >= 25) return { label: 'Moderate', k: 'med' };
  return { label: 'Healthy', k: 'low' };
}

export const criticalityToken: Record<Criticality, string> = {
  Critical: 'crit',
  High: 'high',
  Medium: 'med',
  Low: 'low',
};
