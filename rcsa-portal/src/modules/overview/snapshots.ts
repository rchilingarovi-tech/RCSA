// Daily snapshot of the portal's headline metrics — so the Main Dashboard can show
// REAL trend deltas ("vs previous period") instead of fabricated ones. One record
// per calendar day; the delta compares today against the most recent prior day.
// Migration: this becomes a server-side time-series; the shape stays the same.

export interface OverviewSnapshot {
  date: string; // YYYY-MM-DD
  criticalResidual: number;
  overdueTreatments: number;
  highValueAssets: number;
  complianceScore: number;
  openIncidents: number;
}

export type SnapshotMetrics = Omit<OverviewSnapshot, 'date'>;

const KEY = 'infosec.overview.snapshots.v1';
const CAP = 180; // ~6 months of daily points

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): OverviewSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OverviewSnapshot[]) : [];
  } catch {
    return [];
  }
}

function write(rows: OverviewSnapshot[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-CAP)));
  } catch {
    /* storage unavailable — trends simply won't persist */
  }
}

/** Record (or replace) today's snapshot. Idempotent within a day. */
export function recordSnapshot(m: SnapshotMetrics): void {
  const date = todayStr();
  const rows = read().filter((r) => r.date !== date);
  rows.push({ date, ...m });
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  write(rows);
}

/** The most recent snapshot from a day BEFORE today, or null if none yet. */
export function previousSnapshot(): OverviewSnapshot | null {
  const date = todayStr();
  const prior = read().filter((r) => r.date < date);
  return prior.length ? prior[prior.length - 1] : null;
}
