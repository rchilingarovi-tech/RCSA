import type { Frequency, Kpi } from './types';

// Deterministic demo data (sanitized/fake).
type Row = [string, string, string, number, number, string, Frequency, string, boolean, number[]];

const ROWS: Row[] = [
  ['KPI-01', 'Mean time to detect (MTTD)', 'Incident', 24, 31, 'hrs', 'Monthly', 'Tamar Kvirikashvili', true, [42, 40, 38, 35, 33, 31]],
  ['KPI-02', 'Mean time to respond (MTTR)', 'Incident', 48, 40, 'hrs', 'Monthly', 'Giorgi Beridze', true, [58, 55, 50, 46, 43, 40]],
  ['KPI-03', 'Critical vulns open >30 days', 'Risk', 0, 3, 'count', 'Monthly', 'Tamar Kvirikashvili', true, [7, 6, 5, 4, 4, 3]],
  ['KPI-04', 'Patch compliance', 'Compliance', 95, 88, '%', 'Monthly', 'Tamar Kvirikashvili', false, [80, 82, 84, 86, 87, 88]],
  ['KPI-05', 'Phishing click rate', 'Awareness', 5, 7.2, '%', 'Quarterly', 'Nino Gelashvili', true, [14, 12, 10, 9, 8, 7.2]],
  ['KPI-06', 'Security training completion', 'Awareness', 95, 91, '%', 'Quarterly', 'Nino Gelashvili', false, [78, 82, 85, 88, 90, 91]],
  ['KPI-07', 'ISO 27001 control coverage', 'Compliance', 90, 75, '%', 'Quarterly', 'Nino Gelashvili', false, [60, 64, 68, 71, 73, 75]],
  ['KPI-08', 'Overdue treatment plans', 'Risk', 0, 2, 'count', 'Monthly', 'Giorgi Beridze', true, [5, 4, 4, 3, 3, 2]],
  ['KPI-09', 'High/Critical open risks', 'Risk', 3, 6, 'count', 'Monthly', 'Giorgi Beridze', true, [9, 8, 8, 7, 6, 6]],
  ['KPI-10', 'Vendor assessments current', 'Compliance', 100, 80, '%', 'Quarterly', 'Tamar Kvirikashvili', false, [60, 65, 70, 74, 78, 80]],
  ['KPI-11', 'Access reviews on time', 'Governance', 100, 92, '%', 'Quarterly', 'Salome Tsiklauri', false, [84, 86, 88, 90, 91, 92]],
  ['KPI-12', 'Security incidents (high+)', 'Incident', 2, 4, 'count', 'Monthly', 'Tamar Kvirikashvili', true, [6, 5, 5, 4, 5, 4]],
];

export const SEED_KPIS: Kpi[] = ROWS.map((r) => ({
  id: r[0],
  name: r[1],
  category: r[2],
  target: r[3],
  current: r[4],
  unit: r[5],
  frequency: r[6],
  owner: r[7],
  lowerBetter: r[8],
  history: r[9],
}));
