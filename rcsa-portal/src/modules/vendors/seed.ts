import type { Vendor } from './types';

// Deterministic demo data (sanitized/fake). Contract dates are relative to "now"
// so the expired / renewal states stay realistic whenever the demo is opened.
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_VENDORS: Vendor[] = [
  { id: 'VEN-01', name: 'CorePro Banking Ltd', criticality: 'Critical', dataAccess: 'Restricted', score: 22, contractExpiry: iso(300), certs: ['ISO 27001', 'SOC 2'] },
  { id: 'VEN-02', name: 'CardFlow Processing', criticality: 'Critical', dataAccess: 'Restricted', score: 41, contractExpiry: iso(45), certs: ['PCI-DSS', 'ISO 27001'] },
  { id: 'VEN-03', name: 'CloudMail SaaS', criticality: 'High', dataAccess: 'Confidential', score: 35, contractExpiry: iso(180), certs: ['SOC 2'] },
  { id: 'VEN-04', name: 'SecureShred Services', criticality: 'Low', dataAccess: 'Internal', score: 58, contractExpiry: iso(-20), certs: [] },
  { id: 'VEN-05', name: 'NetGuard MSSP', criticality: 'High', dataAccess: 'Confidential', score: 18, contractExpiry: iso(240), certs: ['ISO 27001', 'SOC 2'] },
  { id: 'VEN-06', name: 'FacilityPlus Cleaning', criticality: 'Low', dataAccess: 'None', score: 71, contractExpiry: iso(120), certs: [] },
];
