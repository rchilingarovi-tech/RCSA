import type { Kpi } from './types';

export const SEED_KPIS: Kpi[] = [
  { id: 'KPI-01', name: 'Phishing simulation click rate', target: 5, current: 7.1, unit: '%', direction: 'Lower is better', history: '14,12,10.5,9,8.2,7.1' },
  { id: 'KPI-02', name: 'Critical patch SLA compliance', target: 95, current: 91, unit: '%', direction: 'Higher is better', history: '82,85,88,90,89,91' },
  { id: 'KPI-03', name: 'Mean time to contain (P1/P2)', target: 24, current: 19, unit: 'h', direction: 'Lower is better', history: '40,35,30,26,22,19' },
  { id: 'KPI-04', name: 'Risks past residual review date', target: 0, current: 3, unit: '', direction: 'Lower is better', history: '9,8,6,5,4,3' },
  { id: 'KPI-05', name: 'Persona migration coverage', target: 100, current: 46, unit: '%', direction: 'Higher is better', history: '5,12,20,28,37,46' },
  { id: 'KPI-06', name: 'Awareness training completion', target: 98, current: 93, unit: '%', direction: 'Higher is better', history: '70,78,84,88,91,93' },
];
