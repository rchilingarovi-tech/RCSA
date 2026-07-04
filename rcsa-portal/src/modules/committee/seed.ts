import type { Meeting } from './types';

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export const SEED_MEETINGS: Meeting[] = [
  { id: 'MTG-01', title: 'InfoSec Steering Committee — Q2', date: iso(-20), attendance: 'CISO, CIO, CRO, Heads of IT/Ops', decisions: 'Approved next-phase budget; accepted vendor risk R7 for 60 days', openActions: 2, status: 'Minutes Issued' },
  { id: 'MTG-02', title: 'Risk Committee — monthly', date: iso(-8), attendance: 'CRO, CISO, Internal Audit', decisions: 'Residual review of ransomware risk; escalation threshold updated', openActions: 3, status: 'Minutes Issued' },
  { id: 'MTG-03', title: 'Security Working Group #14', date: iso(-3), attendance: 'Identity Team, InfoSec, Branch IT', decisions: 'Persona shadow-mode results reviewed', openActions: 5, status: 'Held' },
  { id: 'MTG-04', title: 'InfoSec Steering Committee — Q3', date: iso(25), attendance: '', decisions: '', openActions: 0, status: 'Scheduled' },
  { id: 'MTG-05', title: 'Incident post-mortem — INC-003', date: iso(4), attendance: '', decisions: '', openActions: 0, status: 'Scheduled' },
];
