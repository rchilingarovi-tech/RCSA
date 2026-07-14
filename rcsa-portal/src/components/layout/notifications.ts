// Aggregates real, actionable alerts from each module's repo for the header bell.
// Read-only and shell-level: it reads each standalone repo independently — it does
// NOT couple the modules to each other.
import type { Treatment } from '../../data/models';
import { isOverdue, today } from '../../domain/scoring';
import { vendorRepo } from '../../modules/vendors/repo';
import { policyRepo } from '../../modules/policies/repo';
import { reviewDue } from '../../modules/policies/types';
import { accessRepo } from '../../modules/access/repo';
import { overdue as accessOverdue } from '../../modules/access/types';
import { awarenessRepo } from '../../modules/awareness/repo';
import { overdue as awarenessOverdue } from '../../modules/awareness/types';
import { kpiRepo } from '../../modules/kpis/repo';
import { rag } from '../../modules/kpis/types';

export interface AppNotification {
  id: string;
  moduleId: string; // where clicking the notification navigates
  icon: string; // Icon name
  k: string; // status colour token
  title: string;
  body: string;
}

const plural = (n: number, s: string) => `${n} ${s}${n === 1 ? '' : 's'}`;

export function buildNotifications(treatments: Treatment[]): AppNotification[] {
  const out: AppNotification[] = [];

  const overdueTreatments = treatments.filter(isOverdue).length;
  if (overdueTreatments) {
    out.push({ id: 'trt-overdue', moduleId: 'treatment-catalogue', icon: 'tool', k: 'crit', title: 'Treatments overdue', body: `${plural(overdueTreatments, 'treatment plan')} past their due date.` });
  }

  const vendors = vendorRepo.list();
  const in120 = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10);
  const expired = vendors.filter((v) => v.contractExpiry < today()).length;
  const renewing = vendors.filter((v) => v.contractExpiry >= today() && v.contractExpiry <= in120).length;
  if (expired) out.push({ id: 'ven-expired', moduleId: 'vendors', icon: 'building', k: 'crit', title: 'Vendor contracts expired', body: `${plural(expired, 'contract')} have lapsed.` });
  if (renewing) out.push({ id: 'ven-renew', moduleId: 'vendors', icon: 'clock', k: 'high', title: 'Vendor renewals due', body: `${plural(renewing, 'contract')} renewing within 120 days.` });

  const docsDue = policyRepo.list().filter(reviewDue).length;
  if (docsDue) out.push({ id: 'pol-due', moduleId: 'policies', icon: 'doc', k: 'med', title: 'Documents due for review', body: `${plural(docsDue, 'document')} need review.` });

  const accessLate = accessRepo.list().filter(accessOverdue).length;
  if (accessLate) out.push({ id: 'acr-overdue', moduleId: 'access-reviews', icon: 'key', k: 'crit', title: 'Access reviews overdue', body: `${plural(accessLate, 'campaign')} past due.` });

  const trainingLate = awarenessRepo.list().filter(awarenessOverdue).length;
  if (trainingLate) out.push({ id: 'trn-overdue', moduleId: 'awareness', icon: 'grad', k: 'crit', title: 'Training overdue', body: `${plural(trainingLate, 'course')} past their deadline.` });

  const kpisOff = kpiRepo.list().filter((kp) => rag(kp) === 'crit').length;
  if (kpisOff) out.push({ id: 'kpi-off', moduleId: 'kpis', icon: 'chart', k: 'high', title: 'KPIs off track', body: `${plural(kpisOff, 'metric')} below target.` });

  return out;
}
