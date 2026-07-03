// Compliance module — standalone (not linked to RCSA). Own model + storage.

export const FRAMEWORKS = ['ISO 27001', 'NIST CSF', 'PCI-DSS', 'SOC 2', 'GDPR'] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const CONTROL_STATUSES = ['Implemented', 'In Progress', 'Not Started', 'Not Applicable'] as const;
export type ControlStatus = (typeof CONTROL_STATUSES)[number];

export interface ComplianceControl {
  id: string; // stable unique id (CTL-###)
  framework: Framework;
  ref: string; // control reference, e.g. "A.5.1"
  title: string;
  domain: string;
  status: ControlStatus;
  evidence: boolean;
  owner: string;
  assessed: string; // YYYY-MM-DD
}

/** Coverage % = implemented / applicable (excludes Not Applicable). */
export function coverage(controls: ComplianceControl[]): number {
  const applicable = controls.filter((c) => c.status !== 'Not Applicable');
  if (applicable.length === 0) return 0;
  return Math.round((applicable.filter((c) => c.status === 'Implemented').length / applicable.length) * 100);
}

export function statusColor(s: ControlStatus): string {
  return s === 'Implemented' ? 'low' : s === 'In Progress' ? 'info' : s === 'Not Started' ? 'crit' : 'mut';
}
