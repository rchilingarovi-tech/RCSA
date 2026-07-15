import type { Asset, Risk, Treatment } from '../data/models';

// Pure domain logic — ported verbatim from the prototype (New Version.html L544-548).

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Format a Date as LOCAL YYYY-MM-DD (never toISOString — that is UTC, which in
 *  GMT+4 puts 00:00–04:00 on yesterday's date). */
export function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's date in local ISO (YYYY-MM-DD). A function (not a module-load
 *  constant) so long-lived tabs never evaluate overdue logic against a stale date. */
export function today(): string {
  return localIso(new Date());
}

/** Local ISO date `days` from today (review / renewal windows). */
export function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localIso(d);
}

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

export function inherentScore(r: Risk): number {
  return r.impact * r.likelihood;
}

/** Residual is assessed only when BOTH impact and likelihood are set. */
export function hasResidual(r: Pick<Risk, 'resImpact' | 'resLikelihood'>): boolean {
  return r.resImpact != null && r.resLikelihood != null;
}

/** Residual score, or null when residual risk has not been assessed. */
export function residualScore(r: Risk): number | null {
  return hasResidual(r) ? (r.resImpact as number) * (r.resLikelihood as number) : null;
}

// ── Treatment status (Treatment is its own entity addressing risks) ──

/** A treatment is overdue if its due date has passed and it isn't completed. */
export function isOverdue(t: Treatment): boolean {
  return !!t.dueDate && t.status !== 'Completed' && t.dueDate < today();
}

/** The effective status of a single treatment (Overdue overrides). */
export function treatmentStatus(t: Treatment): string {
  return isOverdue(t) ? 'Overdue' : t.status;
}

/** Treatments addressing a given risk. */
export function treatmentsForRisk(treatments: Treatment[], riskId: string): Treatment[] {
  return treatments.filter((t) => t.riskIds.includes(riskId));
}

/**
 * A risk's treatment status rolled up from its treatments:
 *   none → No Plan · any overdue → Overdue · all complete → Completed · else In Progress.
 */
export function rollupStatus(treatments: Treatment[]): string {
  if (treatments.length === 0) return 'No Plan';
  if (treatments.some(isOverdue)) return 'Overdue';
  if (treatments.every((t) => t.status === 'Completed')) return 'Completed';
  return 'In Progress';
}

/** Convenience: rollup status for a risk given the full treatment set. */
export function riskStatus(risk: Risk, treatments: Treatment[]): string {
  return rollupStatus(treatmentsForRisk(treatments, risk.id));
}

/** Whether a risk has at least one overdue treatment. */
export function riskOverdue(risk: Risk, treatments: Treatment[]): boolean {
  return treatmentsForRisk(treatments, risk.id).some(isOverdue);
}

/** Badge classes for a treatment / rollup status. */
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
