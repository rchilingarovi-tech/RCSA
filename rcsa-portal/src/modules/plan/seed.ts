import type { Initiative, PlanStatus, Priority } from './types';

// Deterministic demo data (sanitized/fake).
type Row = [string, string, string, string, string, Priority, PlanStatus, number];

const ROWS: Row[] = [
  ['INI-01', 'Zero Trust Network Rollout', 'Security Architecture', 'Q1–Q3', 'Tamar Kvirikashvili', 'High', 'In Progress', 55],
  ['INI-02', 'ISO 27001 Recertification', 'Compliance', 'Q2–Q4', 'Nino Gelashvili', 'Critical', 'In Progress', 40],
  ['INI-03', 'SOC / SIEM Deployment', 'Detection', 'Q2–Q3', 'Tamar Kvirikashvili', 'High', 'In Progress', 30],
  ['INI-04', 'PAM Implementation', 'Identity', 'Q3', 'Giorgi Beridze', 'High', 'Planned', 0],
  ['INI-05', 'Security Awareness Refresh', 'Awareness', 'Q1–Q4', 'Nino Gelashvili', 'Medium', 'In Progress', 60],
  ['INI-06', 'Third-Party Risk Program', 'GRC', 'Q2–Q4', 'Tamar Kvirikashvili', 'Medium', 'In Progress', 25],
  ['INI-07', 'DLP Expansion', 'Data Protection', 'Q3–Q4', 'Salome Tsiklauri', 'Medium', 'Planned', 0],
  ['INI-08', 'Legacy System Decommission', 'Infrastructure', 'Q1–Q2', 'Tamar Kvirikashvili', 'High', 'In Progress', 70],
];

export const SEED_INITIATIVES: Initiative[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  category: r[2],
  quarter: r[3],
  owner: r[4],
  priority: r[5],
  status: r[6],
  progress: r[7],
}));
