// Department KPIs — standalone module (not linked to RCSA). Own model + storage.

export const FREQUENCIES = ['Monthly', 'Quarterly', 'Annual'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export interface Kpi {
  id: string; // KPI-###
  name: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  frequency: Frequency;
  owner: string;
  lowerBetter: boolean; // true when a lower value is better (e.g. MTTD)
  history: number[]; // oldest → newest, for the sparkline
}

export type Rag = 'low' | 'med' | 'crit';

/** RAG status, honouring whether lower is better. low=On Track, med=At Risk, crit=Off Track. */
export function rag(k: Pick<Kpi, 'current' | 'target' | 'lowerBetter'>): Rag {
  if (k.lowerBetter) {
    if (k.current <= k.target) return 'low';
    if (k.current <= k.target * 1.25 || k.current <= k.target + 2) return 'med';
    return 'crit';
  }
  if (k.current >= k.target) return 'low';
  if (k.current >= k.target * 0.9) return 'med';
  return 'crit';
}

export function ragWord(r: Rag): string {
  return r === 'low' ? 'On Track' : r === 'med' ? 'At Risk' : 'Off Track';
}

export const ragColor = (r: Rag) => `var(--${r})`;

/** Whether the latest trend is an improvement, given the metric direction. */
export function improving(k: Kpi): boolean {
  if (k.history.length < 2) return true;
  const up = k.history[k.history.length - 1] >= k.history[0];
  return k.lowerBetter ? !up : up;
}
