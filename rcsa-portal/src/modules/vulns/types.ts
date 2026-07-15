// Vulnerability / Pentest Findings — standalone module. Own model + storage.
// Finding-level remediation tracking with SEVERITY-BASED SLAs: the deadline is
// DERIVED (discovered + SLA days), so it can never drift from the policy.
import { localIso, today } from '../../domain/scoring';

export const VULN_SOURCES = ['Vulnerability Scan', 'Penetration Test', 'Red Team', 'Bug Bounty'] as const;
export type VulnSource = (typeof VULN_SOURCES)[number];

export const VULN_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type VulnSeverity = (typeof VULN_SEVERITIES)[number];

export const VULN_STATUSES = ['Open', 'In Remediation', 'Risk Accepted', 'Resolved'] as const;
export type VulnStatus = (typeof VULN_STATUSES)[number];

/** Departmental remediation SLA (days from discovery) per severity. */
export const SLA_DAYS: Record<VulnSeverity, number> = { Critical: 14, High: 30, Medium: 90, Low: 180 };

export interface Vuln {
  id: string; // VUL-##
  title: string;
  source: VulnSource;
  ref: string; // report / scanner reference, e.g. "PT-2026-02 F-04" or CVE id
  asset: string; // affected asset / system
  severity: VulnSeverity;
  cvss: string; // optional CVSS base score, '' when not scored
  discovered: string; // YYYY-MM-DD
  owner: string; // remediation owner
  status: VulnStatus;
  description: string; // technical detail (redacted from audit-trail diffs)
  remediation: string; // fix plan (redacted from audit-trail diffs)
}

export const severityTone: Record<VulnSeverity, string> = { Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' };
export const statusTone: Record<VulnStatus, string> = { Open: 'high', 'In Remediation': 'info', 'Risk Accepted': 'purple', Resolved: 'low' };
export const sourceTone: Record<VulnSource, string> = { 'Vulnerability Scan': 'info', 'Penetration Test': 'purple', 'Red Team': 'crit', 'Bug Bounty': 'ok' };

/** Open = still needs remediation. Risk Accepted / Resolved end the SLA clock. */
export const isOpenVuln = (v: Pick<Vuln, 'status'>): boolean => v.status === 'Open' || v.status === 'In Remediation';

// Local date math — toISOString() is UTC and shifts GMT+4 deadlines a day early.
const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localIso(d);
};

/** SLA deadline derived from discovery date + severity policy ('' when undated). */
export function slaDeadline(v: Pick<Vuln, 'discovered' | 'severity'>): string {
  return v.discovered ? addDays(v.discovered, SLA_DAYS[v.severity]) : '';
}

/** Days until the SLA deadline (negative = past due); null when undated. */
export function slaDaysLeft(v: Pick<Vuln, 'discovered' | 'severity'>): number | null {
  const d = slaDeadline(v);
  if (!d) return null;
  return Math.round((new Date(d).getTime() - new Date(today()).getTime()) / 86400000);
}

/** SLA breached = still open and past the derived deadline. Also used by the bell. */
export function slaBreached(v: Pick<Vuln, 'status' | 'discovered' | 'severity'>): boolean {
  if (!isOpenVuln(v)) return false;
  const left = slaDaysLeft(v);
  return left != null && left < 0;
}
