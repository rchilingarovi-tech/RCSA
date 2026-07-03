import type { Incident } from './types';

// Deterministic demo data (sanitized/fake). Dates relative to "now" so open/closed
// states stay realistic whenever the demo is opened.
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_INCIDENTS: Incident[] = [
  { id: 'INC-001', title: 'Phishing email bypassed gateway', severity: 'High', status: 'Closed', category: 'Phishing', categoryOther: '', rootCause: 'New sender domain not yet classified by the filter', corrective: 'Added lookalike-domain rule; user reported promptly', opened: iso(-42), closed: iso(-39) },
  { id: 'INC-002', title: 'Malware detected on branch workstation', severity: 'Medium', status: 'Closed', category: 'Malware', categoryOther: '', rootCause: 'USB device from unknown source', corrective: 'USB blocking policy extended to branch OU', opened: iso(-30), closed: iso(-28) },
  { id: 'INC-003', title: 'Excessive failed logins on SWIFT ops account', severity: 'Critical', status: 'Contained', category: 'Access Misuse', categoryOther: '', rootCause: '', corrective: 'Account locked, credentials rotated', opened: iso(-3), closed: '' },
  { id: 'INC-004', title: 'Customer data emailed to wrong recipient', severity: 'High', status: 'Investigating', category: 'Data Leak', categoryOther: '', rootCause: '', corrective: '', opened: iso(-2), closed: '' },
  { id: 'INC-005', title: 'DDoS attempt on internet banking', severity: 'Medium', status: 'Closed', category: 'DDoS', categoryOther: '', rootCause: 'Volumetric attack absorbed by scrubbing provider', corrective: 'None required; runbook validated', opened: iso(-60), closed: iso(-60) },
  { id: 'INC-006', title: 'Expired TLS certificate on partner API', severity: 'Low', status: 'Closed', category: 'Other', categoryOther: 'Certificate management', rootCause: 'Certificate not in the monitoring inventory', corrective: 'Added to certificate monitoring', opened: iso(-21), closed: iso(-20) },
  { id: 'INC-007', title: 'Suspicious OAuth consent grant', severity: 'High', status: 'Open', category: 'Access Misuse', categoryOther: '', rootCause: '', corrective: '', opened: iso(-1), closed: '' },
];
