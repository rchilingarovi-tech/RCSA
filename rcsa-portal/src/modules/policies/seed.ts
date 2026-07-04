import type { PolicyDoc } from './types';

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_POLICIES: PolicyDoc[] = [
  { id: 'POL-01', title: 'Information Security Policy', type: 'Policy', version: '4.0', status: 'Approved', owner: 'CISO', nextReview: iso(200) },
  { id: 'POL-02', title: 'Access Control Standard', type: 'Standard', version: '3.1', status: 'Approved', owner: 'Identity Team', nextReview: iso(-10) },
  { id: 'POL-03', title: 'Incident Response Procedure', type: 'Procedure', version: '2.4', status: 'Approved', owner: 'SecOps', nextReview: iso(90) },
  { id: 'POL-04', title: 'Acceptable Use Policy', type: 'Policy', version: '2.0', status: 'In Review', owner: 'HR / InfoSec', nextReview: iso(15) },
  { id: 'POL-05', title: 'Cryptography Standard', type: 'Standard', version: '1.3', status: 'Approved', owner: 'InfoSec', nextReview: iso(160) },
  { id: 'POL-06', title: 'Vendor Security Guideline', type: 'Guideline', version: '1.0', status: 'Draft', owner: 'Vendor Mgmt', nextReview: iso(30) },
  { id: 'POL-07', title: 'Exception Handling Procedure', type: 'Procedure', version: '1.1', status: 'Approved', owner: 'CISO', nextReview: iso(120) },
  { id: 'POL-08', title: 'Data Classification Policy', type: 'Policy', version: '3.0', status: 'Retired', owner: 'DPO', nextReview: '' },
];
