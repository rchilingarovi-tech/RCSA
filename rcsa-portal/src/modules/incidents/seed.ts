import type { Incident, IncidentCategory, IncidentStatus, Severity } from './types';

// Deterministic demo data (sanitized/fake). Dates relative to "now".
const now = Date.now();
const dt = (daysAgo: number, hour: number) => {
  const d = new Date(now - daysAgo * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
};
const dateOnly = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString().slice(0, 10);

// [id, shortDesc, repDaysAgo, occLagDays, reportedBy, category, severity, asset, status, responsible, closedDaysAgo|-1, description, rootCause, correctiveAction]
type Row = [string, string, number, number, string, IncidentCategory, Severity, string, IncidentStatus, string, number, string, string, string];

const ROWS: Row[] = [
  ['INC-001', 'Phishing campaign targeting finance team', 3, 0, 'Help Desk', 'Phishing', 'High', 'Email Gateway', 'Closed', 'Tamar Kvirikashvili', 1, 'Multiple finance staff received credential-harvesting emails impersonating the bank. Two users clicked; passwords reset and the sender domain was blocked.', 'A look-alike sender domain was not blocked, and users did not recognise the urgency cues.', 'Blocked the sender domain, reset affected passwords and ran a targeted phishing-awareness refresher.'],
  ['INC-002', 'Ransomware behaviour detected on workstation', 1, 0, 'SOC Alert', 'Malware', 'Critical', 'Workstation WS-204', 'In Progress', 'Giorgi Beridze', -1, 'EDR flagged file-encryption behaviour on WS-204. Host isolated from the network; investigating scope and possible lateral movement.', 'Under investigation — suspected malicious email attachment.', 'Host isolated; EDR scan and memory capture in progress.'],
  ['INC-003', 'Unauthorized VPN login from foreign IP', 6, 0, 'SOC Alert', 'Unauthorized Access', 'High', 'VPN Gateway', 'Closed', 'Giorgi Beridze', 4, 'Successful VPN authentication from an unusual geolocation outside business hours. MFA enforced, account secured; no data access confirmed.', 'Password reuse combined with MFA not being enforced on the VPN profile.', 'Enforced MFA on all VPN profiles, reset credentials and added geo-velocity alerting.'],
  ['INC-004', 'Customer data exposed via misconfigured storage', 9, 2, 'External Researcher', 'Data Leak', 'Critical', 'AWS S3 bucket', 'In Progress', 'Nino Gelashvili', -1, 'A storage bucket holding statements was publicly readable. Public access revoked; assessing exposure window and breach-notification obligations.', 'A bucket policy was changed during a deployment without review.', 'Revoked public access; reviewing infrastructure-as-code guardrails and the exposure window.'],
  ['INC-005', 'DDoS attack on public website', 14, 0, 'NOC', 'Denial of Service', 'High', 'Public Web Front-end', 'Closed', 'Tamar Kvirikashvili', 13, 'Volumetric attack degraded the public site for ~40 minutes. Mitigated via upstream scrubbing; no breach of internal systems.', 'No upstream DDoS protection was configured on the public endpoint.', 'Enabled upstream scrubbing and rate limiting; added traffic-anomaly alerts.'],
  ['INC-006', 'Lost unencrypted laptop', 20, 1, 'Branch Manager', 'Physical', 'Medium', 'Laptop LT-118', 'Pending', 'Salome Tsiklauri', -1, 'A field laptop was reported lost. Disk-encryption status unconfirmed — awaiting asset-record verification before closing risk.', '', 'Remote-wipe requested; awaiting encryption-status confirmation from the asset register.'],
  ['INC-007', 'Employee shared credentials with colleague', 25, 3, 'Line Manager', 'Policy Violation', 'Medium', 'Core Banking', 'Closed', 'Nino Gelashvili', 22, 'A shared login was used to cover annual leave. Credentials rotated and refresher security-awareness training assigned.', 'No documented cover-for-leave process, so a shared login was tolerated.', 'Rotated credentials, issued individual accounts and assigned a policy refresher.'],
  ['INC-008', 'Suspicious PowerShell execution on server', 2, 0, 'SOC Alert', 'Malware', 'High', 'Server SRV-09', 'Open', 'Giorgi Beridze', -1, 'Encoded PowerShell launched outside the change window. Under triage; host placed under heightened monitoring.', '', ''],
  ['INC-009', 'CEO impersonation / BEC attempt', 4, 0, 'Finance Officer', 'Phishing', 'Critical', 'Email', 'Open', 'Tamar Kvirikashvili', -1, 'Fraudulent wire-transfer request impersonating the CEO. Payment halted before processing; investigating the sender infrastructure.', '', 'Payment halted; finance call-back verification procedure reinforced pending investigation.'],
  ['INC-010', 'Brute-force attempts on admin portal', 8, 0, 'SOC Alert', 'Unauthorized Access', 'Medium', 'Admin Portal', 'In Progress', 'Giorgi Beridze', -1, 'Repeated failed logins from a botnet IP range. Rate-limiting and IP blocks applied; reviewing logs for any successful access.', 'The admin portal was reachable from the internet without IP allow-listing.', 'Applied rate-limiting and IP blocks; reviewing logs for any successful login.'],
  ['INC-011', 'Tailgating into data centre', 34, 0, 'Physical Security', 'Physical', 'Low', 'DC Access', 'Closed', 'Salome Tsiklauri', 30, 'A visitor followed staff through a controlled door. Incident logged and badge-in policy reinforced with the team.', 'Door-hold courtesy behaviour with no anti-tailgating control in place.', 'Reinforced the badge-in policy, added signage and is evaluating a mantrap.'],
  ['INC-012', 'Outdated TLS on payment API', 45, 5, 'Penetration Test', 'Policy Violation', 'Low', 'Payment API', 'Pending', 'Nino Gelashvili', -1, 'A scan flagged deprecated TLS 1.0 on a payment endpoint. Remediation scheduled with the platform team.', 'Legacy TLS configuration was never decommissioned after the platform upgrade.', 'Remediation scheduled with the platform team to disable TLS 1.0/1.1.'],
];

export const SEED_INCIDENTS: Incident[] = ROWS.map((r) => ({
  id: r[0],
  shortDesc: r[1],
  reportedAt: dt(r[2], 9),
  occurredAt: dt(r[2] + r[3], 14),
  reportedBy: r[4],
  category: r[5],
  categoryOther: '',
  severity: r[6],
  asset: r[7],
  status: r[8],
  responsible: r[9],
  closedAt: r[10] >= 0 ? dateOnly(r[10]) : '',
  description: r[11],
  rootCause: r[12],
  correctiveAction: r[13],
}));
