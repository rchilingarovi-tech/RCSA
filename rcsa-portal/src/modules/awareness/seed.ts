import type { Course, Delivery, TrainingStatus } from './types';

// Deterministic demo data (sanitized/fake). Due dates relative to "now".
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Row = [string, string, string, Delivery, number, number, TrainingStatus];

const ROWS: Row[] = [
  ['TRN-01', 'Security Awareness Foundations', 'All Employees', 'E-learning', 30, 91, 'In Progress'],
  ['TRN-02', 'Phishing Simulation — Wave 3', 'All Employees', 'Phishing Simulation', -40, 100, 'Completed'],
  ['TRN-03', 'Secure Coding', 'Developers', 'Workshop', 45, 67, 'In Progress'],
  ['TRN-04', 'PCI-DSS Handling', 'Payments Team', 'Classroom', -5, 82, 'Overdue'],
  ['TRN-05', 'Data Privacy & GDPR', 'All Employees', 'E-learning', 90, 45, 'Assigned'],
  ['TRN-06', 'Incident Response Drill', 'IT & Security', 'Workshop', -20, 100, 'Completed'],
];

export const SEED_COURSES: Course[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  audience: r[2],
  delivery: r[3],
  due: iso(r[4]),
  completion: r[5],
  status: r[6],
}));
