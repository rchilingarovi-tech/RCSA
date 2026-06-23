import type { DataClass, AssetStatus, Assessment, TreatmentStatus } from '../data/models';

// Catalogue lists, ported from the prototype's <option> sets and control checkboxes.

export const DATA_CLASSES: DataClass[] = [
  'Public',
  'Internal',
  'Confidential',
  'Personal Data',
  'Payment Data',
];

export const ASSET_STATUSES: AssetStatus[] = [
  'Draft',
  'Submitted',
  'Reviewed by InfoSec',
  'Approved',
  'Needs Update',
];

export const ASSESSMENTS: Assessment[] = ['Mitigate', 'Accept', 'Transfer', 'Avoid'];

export const TREATMENT_STATUSES: TreatmentStatus[] = ['Open', 'In Progress', 'Completed'];

// Threat catalogue (New Version.html L314)
export const THREAT_CATALOGUE: string[] = [
  'Malware infection',
  'Information disclosure',
  'Digital identity and/or certificate theft',
  'Eavesdropping',
  'Power outage',
  'Social engineering',
  'Hardware replacement',
  'DDoS',
  'Internal Data Exfiltration',
  'Violation of laws and/or regulations',
];

export const OTHER_THREAT = '__OTHER__';

// Control catalogue (New Version.html L380-397)
export const CONTROL_CATALOGUE: string[] = [
  'Backup exists',
  'DR plan exists',
  'MFA enabled',
  'Antivirus/EDR installed',
  'Network segmentation',
  'Access review performed',
  'Physical access control',
  'Monitoring/SIEM rule exists',
  'Vendor SLA exists',
  'Patch management process',
  'Encryption enabled',
  'DLP monitoring',
  'WAF protection',
  'Incident response playbook',
  'Vulnerability scanning',
  'Security awareness training',
  'Data classification applied',
  'Privileged access management',
];

// CIA dropdown options
export const CIA_OPTIONS = [
  { value: 1, label: '1 – Low' },
  { value: 2, label: '2 – Med' },
  { value: 3, label: '3 – High' },
] as const;

// Impact (1–5) options for risk scoring
export const IMPACT_OPTIONS = [
  { value: 1, label: '1 – Negligible' },
  { value: 2, label: '2 – Minor' },
  { value: 3, label: '3 – Moderate' },
  { value: 4, label: '4 – Major' },
  { value: 5, label: '5 – Critical' },
] as const;

// Likelihood (1–5) options for risk scoring
export const LIKELIHOOD_OPTIONS = [
  { value: 1, label: '1 – Rare' },
  { value: 2, label: '2 – Unlikely' },
  { value: 3, label: '3 – Possible' },
  { value: 4, label: '4 – Likely' },
  { value: 5, label: '5 – Almost certain' },
] as const;
