import type { DocStatus, DocType, PolicyDoc } from './types';

// Deterministic demo data (sanitized/fake). Review dates relative to "now" so
// the due/overdue states stay realistic.
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Row = [string, string, DocType, string, DocStatus, string, number | null, number | null];

const ROWS: Row[] = [
  ['POL-01', 'Information Security Policy', 'Policy', '3.2', 'Approved', 'Elene Kapanadze', -300, 90],
  ['POL-02', 'Access Control Standard', 'Standard', '2.1', 'Approved', 'Giorgi Beridze', -200, 150],
  ['POL-03', 'Incident Response Procedure', 'Procedure', '1.4', 'Under Review', 'Tamar Kvirikashvili', -380, -15],
  ['POL-04', 'Data Classification Guideline', 'Guideline', '1.0', 'Draft', 'Davit Maisuradze', null, 45],
  ['POL-05', 'Acceptable Use Policy', 'Policy', '4.0', 'Approved', 'Nino Gelashvili', -150, 210],
  ['POL-06', 'Cryptography Standard', 'Standard', '1.2', 'Approved', 'Davit Maisuradze', -240, 30],
  ['POL-07', 'Vendor Management Policy', 'Policy', '2.0', 'Under Review', 'Tamar Kvirikashvili', -320, 10],
  ['POL-08', 'Business Continuity Plan', 'Procedure', '3.1', 'Retired', 'Levan Robakidze', -700, null],
];

export const SEED_POLICIES: PolicyDoc[] = ROWS.map((r) => ({
  id: r[0],
  title: r[1],
  type: r[2],
  version: r[3],
  status: r[4],
  owner: r[5],
  effective: r[6] === null ? '' : iso(r[6]),
  nextReview: r[7] === null ? '' : iso(r[7]),
}));
