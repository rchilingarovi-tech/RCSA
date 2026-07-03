import type { AccessReview, ReviewStatus, Scope } from './types';

// Deterministic demo data (sanitized/fake). Due dates relative to "now".
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Row = [string, string, Scope, string, string, number, ReviewStatus, number];

const ROWS: Row[] = [
  ['ACR-01', 'Core Banking Privileged Access', 'System', '2026 Q2', 'Giorgi Beridze', 20, 'In Progress', 64],
  ['ACR-02', 'AWS IAM Review', 'Application', '2026 Q2', 'Tamar Kvirikashvili', 20, 'In Progress', 45],
  ['ACR-03', 'HR System Access', 'Application', '2026 Q1', 'Salome Tsiklauri', -80, 'Completed', 100],
  ['ACR-04', 'SWIFT Operator Access', 'System', '2026 Q2', 'Giorgi Beridze', -3, 'Not Started', 0],
  ['ACR-05', 'M365 Admin Roles', 'Application', '2026 Q1', 'Nino Gelashvili', -80, 'Completed', 100],
];

export const SEED_ACCESS: AccessReview[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  scope: r[2],
  period: r[3],
  reviewer: r[4],
  due: iso(r[5]),
  status: r[6],
  progress: r[7],
}));
