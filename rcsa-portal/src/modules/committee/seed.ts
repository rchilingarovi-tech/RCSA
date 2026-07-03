import type { Meeting, MeetingStatus } from './types';

// Deterministic demo data (sanitized/fake). Dates relative to "now".
const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

type Row = [string, string, number, number, number, MeetingStatus, string];

const ROWS: Row[] = [
  ['MTG-01', 'Security Steering Committee — Q2', -28, 9, 3, 'Completed', 'Reviewed risk posture, approved treatment budget, ratified updated IS policy.'],
  ['MTG-02', 'Monthly Risk Review — current period', -14, 6, 5, 'Completed', 'Walked through open high/critical risks; assigned owners to overdue treatments.'],
  ['MTG-03', 'Security Steering Committee — Q1', -100, 9, 1, 'Completed', 'Annual programme kick-off; endorsed ISO 27001 recertification plan.'],
  ['MTG-04', 'Monthly Risk Review — upcoming', 12, 6, 4, 'Scheduled', 'Agenda: vendor renewals, access-review status, KPI scorecard.'],
  ['MTG-05', 'Incident Post-Mortem — Phishing', -50, 5, 2, 'Completed', 'Root-cause and lessons learned; awareness wave scheduled.'],
];

export const SEED_MEETINGS: Meeting[] = ROWS.map((r) => ({
  id: r[0],
  title: r[1],
  date: iso(r[2]),
  attendees: r[3],
  openActions: r[4],
  status: r[5],
  notes: r[6],
}));
