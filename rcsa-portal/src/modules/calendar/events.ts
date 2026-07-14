// Master Calendar — cross-service event aggregation.
// PURE: reads no storage. The page collects each module's records and passes them
// in, so every calendar entry is a REAL deadline pulled from a live module (the
// "synchronization" is a genuine re-read, not a mock array).

import type { Risk, Treatment } from '../../data/models';
import { inherentScore, riskLevel, today } from '../../domain/scoring';
import type { Vendor } from '../vendors/types';
import type { AccessReview } from '../access/types';
import type { PolicyDoc } from '../policies/types';
import type { Course } from '../awareness/types';

export type LayerKey = 'risk' | 'vendor' | 'compliance' | 'awareness';
export type EventStatus = 'Overdue' | 'Upcoming' | 'Done';

export interface LayerDef {
  key: LayerKey;
  label: string;
  sub: string;
  tone: string; // status-colour token (crit/info/purple/ok)
}

export const LAYERS: LayerDef[] = [
  { key: 'risk', label: 'Risk Management', sub: 'Treatments & Assessments', tone: 'crit' },
  { key: 'vendor', label: 'Vendor Governance', sub: 'Contract Expirations & Reviews', tone: 'info' },
  { key: 'compliance', label: 'Compliance & Audits', sub: 'ISO 27001, PCI DSS, SWIFT CSP', tone: 'purple' },
  { key: 'awareness', label: 'Awareness Training', sub: 'Campaign Deadlines', tone: 'ok' },
];

export const layerTone = (k: LayerKey): string => LAYERS.find((l) => l.key === k)?.tone ?? 'mut';
export const layerLabel = (k: LayerKey): string => LAYERS.find((l) => l.key === k)?.label ?? k;

export interface CalEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (the deadline)
  layer: LayerKey;
  source: string; // originating platform (shown in the modal)
  moduleId: string; // deep-link target
  owner: string;
  criticality: string;
  type: string;
  description: string;
  status: EventStatus;
  overdueDays: number;
}

export interface CalData {
  treatments: Treatment[];
  risks: Risk[];
  vendors: Vendor[];
  accessReviews: AccessReview[];
  policies: PolicyDoc[];
  courses: Course[];
}

const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86400000);

export function buildCalendarEvents(d: CalData): CalEvent[] {
  const out: CalEvent[] = [];
  const add = (e: Omit<CalEvent, 'status' | 'overdueDays'> & { done?: boolean }) => {
    if (!e.date) return;
    const status: EventStatus = e.done ? 'Done' : e.date < today() ? 'Overdue' : 'Upcoming';
    const { done: _done, ...rest } = e;
    void _done;
    out.push({ ...rest, status, overdueDays: status === 'Overdue' ? Math.max(0, daysBetween(e.date, today())) : 0 });
  };

  d.treatments.forEach((t) =>
    add({
      id: t.id,
      title: t.title || 'Treatment plan',
      date: t.dueDate,
      layer: 'risk',
      source: 'Risk Treatment Service',
      moduleId: 'treatment-catalogue',
      owner: t.owner || '—',
      criticality: '—',
      type: 'Risk Treatment',
      description: t.description || '',
      done: t.status === 'Completed',
    }),
  );

  d.risks.forEach((r) => {
    if (r.assessment === 'Accept' && r.acceptanceExpiry) {
      add({
        id: r.id,
        title: `Risk acceptance expiry — ${r.threat}`,
        date: r.acceptanceExpiry,
        layer: 'risk',
        source: 'Risk Register',
        moduleId: 'risk-catalogue',
        owner: r.owner || '—',
        criticality: riskLevel(inherentScore(r))[0],
        type: 'Risk Acceptance',
        description: 'Accepted-risk review is due — re-assess or renew the acceptance.',
      });
    }
  });

  d.vendors.forEach((v) =>
    add({
      id: v.id,
      title: `${v.name} — contract renewal`,
      date: v.contractExpiry,
      layer: 'vendor',
      source: 'Vendor Governance Platform',
      moduleId: 'vendors',
      owner: '—',
      criticality: v.criticality,
      type: 'Contract Renewal',
      description: `Data access: ${v.dataAccess}. Residual score ${v.score}.`,
    }),
  );

  d.accessReviews.forEach((a) =>
    add({
      id: a.id,
      title: `Access Review – ${a.campaign}`,
      date: a.due,
      layer: 'compliance',
      source: 'Compliance & Audit Service',
      moduleId: 'access-reviews',
      owner: a.reviewer || '—',
      criticality: '—',
      type: 'Access Review',
      description: `${a.scope} · ${a.period} · ${a.progress}% complete`,
      done: a.progress >= 100,
    }),
  );

  d.policies.forEach((p) => {
    if (p.status !== 'Retired' && p.nextReview) {
      add({
        id: p.id,
        title: `Policy review — ${p.title}`,
        date: p.nextReview,
        layer: 'compliance',
        source: 'Policy & Document Control',
        moduleId: 'policies',
        owner: p.owner || '—',
        criticality: '—',
        type: 'Document Review',
        description: `${p.type} · version ${p.version} · ${p.status}`,
      });
    }
  });

  d.courses.forEach((c) =>
    add({
      id: c.id,
      title: c.course,
      date: c.due,
      layer: 'awareness',
      source: 'Awareness Training Service',
      moduleId: 'awareness',
      owner: c.audience || '—',
      criticality: '—',
      type: 'Training Campaign',
      description: `${c.method} · ${c.completion}% complete`,
      done: c.completion >= 100,
    }),
  );

  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// ── Date helpers (local, date-only) ──────────────────────────────────────────
export const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = (): string => today();

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DayCell {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

/** 42-cell (6-week) month grid starting on Sunday. */
export function monthCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: iso(d), day: d.getDate(), inMonth: d.getMonth() === month, isToday: iso(d) === today() });
  }
  return cells;
}

/** The 7 days (Sun→Sat) of the week containing `ref`. */
export function weekCells(ref: Date): DayCell[] {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay());
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({ date: iso(d), day: d.getDate(), inMonth: true, isToday: iso(d) === today() });
  }
  return cells;
}

/** Group events by their date string. */
export function byDate(events: CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>();
  events.forEach((e) => {
    const arr = m.get(e.date) ?? [];
    arr.push(e);
    m.set(e.date, arr);
  });
  return m;
}

// ── Agenda buckets ───────────────────────────────────────────────────────────
export interface Bucket {
  key: string;
  label: string;
  events: CalEvent[];
}

export function agendaBuckets(events: CalEvent[]): Bucket[] {
  const t = new Date(`${today()}T00:00:00`);
  const endOfWeek = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + (6 - t.getDay())));
  const endOfMonth = iso(new Date(t.getFullYear(), t.getMonth() + 1, 0));
  const endOfNextMonth = iso(new Date(t.getFullYear(), t.getMonth() + 2, 0));

  const buckets: Bucket[] = [
    { key: 'overdue', label: 'Overdue', events: [] },
    { key: 'week', label: 'This week', events: [] },
    { key: 'month', label: 'This month', events: [] },
    { key: 'next', label: 'Next month', events: [] },
    { key: 'later', label: 'Later', events: [] },
  ];
  const find = (k: string) => buckets.find((b) => b.key === k)!;

  events
    .filter((e) => e.status !== 'Done')
    .forEach((e) => {
      if (e.status === 'Overdue') find('overdue').events.push(e);
      else if (e.date <= endOfWeek) find('week').events.push(e);
      else if (e.date <= endOfMonth) find('month').events.push(e);
      else if (e.date <= endOfNextMonth) find('next').events.push(e);
      else find('later').events.push(e);
    });

  return buckets.filter((b) => b.events.length > 0);
}

export const fmtLong = (dateIso: string): string => {
  const d = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateIso : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' });
};
