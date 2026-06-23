import type { Asset, Risk } from '../data/models';

// Pure domain logic — ported verbatim from the prototype (New Version.html L544-548).

/** Today's date in ISO (YYYY-MM-DD), computed at module load like the prototype. */
export const today = new Date().toISOString().split('T')[0];

export function assetValue(a: Pick<Asset, 'c' | 'i' | 'a'>): number {
  return a.c * a.i * a.a;
}

export type LevelTuple = [label: string, badgeClass: string];

/** Asset criticality from value (1..27): ≤6 Low, ≤19 Medium, else High. */
export function criticality(v: number): LevelTuple {
  if (v <= 6) return ['Low', 'bg-green-100 text-green-800'];
  if (v <= 19) return ['Medium', 'bg-yellow-100 text-yellow-800'];
  return ['High', 'bg-red-100 text-red-800'];
}

/** Risk level from score (1..25): ≤4 Low, ≤9 Medium, ≤14 High, else Critical. */
export function riskLevel(s: number): LevelTuple {
  if (s <= 4) return ['Low', 'bg-green-100 text-green-800'];
  if (s <= 9) return ['Medium', 'bg-yellow-100 text-yellow-800'];
  if (s <= 14) return ['High', 'bg-orange-100 text-orange-800'];
  return ['Critical', 'bg-red-100 text-red-800'];
}

export function isOverdue(r: Risk): boolean {
  return !!r.deadline && r.treatmentStatus !== 'Completed' && r.deadline < today;
}

export function inherentScore(r: Risk): number {
  return r.impact * r.likelihood;
}

export function residualScore(r: Risk): number {
  return r.resImpact * r.resLikelihood;
}

/** Effective treatment status (Overdue overrides). */
export function effectiveStatus(r: Risk): string {
  return isOverdue(r) ? 'Overdue' : r.treatmentStatus;
}

/** Badge classes for a treatment/effective status (ported from renderRisks L1422). */
export function statusBadgeClass(status: string): string {
  if (status === 'Overdue') return 'bg-red-100 text-red-800';
  if (status === 'Completed') return 'bg-green-100 text-green-800';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
}

/** Generate the next id for a prefix based on array length (ported from genId L544). */
export function genId(prefix: string, arr: { length: number }): string {
  return `${prefix}-${String(arr.length + 1).padStart(3, '0')}`;
}
