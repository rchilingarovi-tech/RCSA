// Department KPIs — standalone module. Own model + storage.
// Model ported from the SentinelGRC reference (direction-aware RAG + string history).

export const DIRECTIONS = ['Higher is better', 'Lower is better'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface Kpi {
  id: string; // KPI-##
  name: string;
  target: number;
  current: number;
  unit: string;
  direction: Direction;
  history: string; // comma-separated values, oldest → newest (real history only)
}

export type Rag = 'low' | 'med' | 'crit';

/** Direction-aware RAG. low = On Track, med = At Risk, crit = Off Track. */
export function rag(k: Pick<Kpi, 'current' | 'target' | 'direction'>): Rag {
  const c = k.current;
  const t = k.target;
  if (k.direction === 'Higher is better') {
    if (c >= t) return 'low';
    if (c >= t * 0.9) return 'med';
    return 'crit';
  }
  if (c <= t) return 'low';
  if (c <= t * 1.25) return 'med';
  return 'crit';
}

export function ragLabel(r: Rag): string {
  return r === 'low' ? 'On Track' : r === 'med' ? 'At Risk' : 'Off Track';
}

/** Parse the stored history string into numbers (real values only). */
export function parseHistory(h: string): number[] {
  return String(h || '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
}

/** Attainment vs target as a 0–100 %, direction-aware. */
export function attainment(k: Pick<Kpi, 'current' | 'target' | 'direction'>): number {
  const c = k.current;
  const t = k.target;
  if (!t) return c === 0 ? 100 : 0;
  const raw = k.direction === 'Higher is better' ? c / t : c <= t ? 1 : t / Math.max(c, 1e-6);
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}
