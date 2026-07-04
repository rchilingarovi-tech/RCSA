import type { Initiative } from './types';

export const SEED_INITIATIVES: Initiative[] = [
  { id: 'INI-01', initiative: 'Persona-based access migration (P1–P3)', category: 'Identity & Access', quarter: 'Q3', owner: 'CISO', priority: 'High', progress: 46 },
  { id: 'INI-02', initiative: 'Legacy AD group decommission', category: 'Identity & Access', quarter: 'Q4', owner: 'Identity Team', priority: 'High', progress: 10 },
  { id: 'INI-03', initiative: 'SIEM detection engineering uplift', category: 'Security Operations', quarter: 'Q2', owner: 'SecOps', priority: 'High', progress: 70 },
  { id: 'INI-04', initiative: 'Third-party risk tiering refresh', category: 'Third-Party Risk', quarter: 'Q3', owner: 'Vendor Mgmt', priority: 'Medium', progress: 25 },
  { id: 'INI-05', initiative: 'DORA readiness assessment', category: 'Compliance', quarter: 'Q3', owner: 'InfoSec', priority: 'High', progress: 35 },
  { id: 'INI-06', initiative: 'Branch endpoint hardening baseline', category: 'Infrastructure', quarter: 'Q2', owner: 'Branch IT', priority: 'Medium', progress: 80 },
  { id: 'INI-07', initiative: 'Tabletop exercise — ransomware', category: 'Resilience', quarter: 'Q4', owner: 'SecOps', priority: 'Medium', progress: 0 },
  { id: 'INI-08', initiative: 'Security awareness refresh 2026', category: 'People', quarter: 'Q1', owner: 'InfoSec', priority: 'Low', progress: 100 },
];
