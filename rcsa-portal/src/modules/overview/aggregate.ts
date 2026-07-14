// Pure cross-module aggregation for the Main (executive) Dashboard.
// NO repo / storage access here — the page reads every module's data and passes it
// in, so this file stays pure and unit-testable (and keeps the modules decoupled).
// Every number the dashboard shows is derived here from real records.

import type { Asset, Risk, Treatment } from '../../data/models';
import {
  assetValue,
  criticality,
  inherentScore,
  residualScore,
  riskLevel,
  isOverdue,
  today,
} from '../../domain/scoring';
import type { Incident } from '../incidents/types';
import { isOpen } from '../incidents/types';
import type { Vendor } from '../vendors/types';
import type { PolicyDoc } from '../policies/types';
import { daysToReview } from '../policies/types';
import type { AccessReview } from '../access/types';
import { overdue as accessOverdue } from '../access/types';
import type { Kpi as KpiMetric } from '../kpis/types';
import { rag } from '../kpis/types';
import type { Meeting } from '../committee/types';
import type { Course } from '../awareness/types';
import { overdue as courseOverdue } from '../awareness/types';
import type { ComplianceControl } from '../compliance/types';
import { coverage } from '../compliance/types';
import type { Finding } from '../findings/types';
import { overdue as findingOverdue, overdueDays as findingOverdueDays, isOpenFinding } from '../findings/types';
import type { Vuln } from '../vulns/types';
import { isOpenVuln, slaBreached, slaDaysLeft, slaDeadline } from '../vulns/types';

export type Level = 'Low' | 'Medium' | 'High' | 'Critical';

/** All the data the dashboard aggregates, read once by the page. */
export interface OverviewData {
  assets: Asset[];
  risks: Risk[];
  treatments: Treatment[];
  incidents: Incident[];
  vendors: Vendor[];
  policies: PolicyDoc[];
  accessReviews: AccessReview[];
  kpis: KpiMetric[];
  meetings: Meeting[];
  courses: Course[];
  controls: ComplianceControl[];
  findings: Finding[];
  vulns: Vuln[];
}

// ── Risk severity helpers ────────────────────────────────────────────────────
/** Effective score = residual when assessed, otherwise inherent. */
export const effectiveScore = (r: Risk): number => residualScore(r) ?? inherentScore(r);
export const effectiveLevel = (r: Risk): Level => riskLevel(effectiveScore(r))[0] as Level;
/** Residual level, or null when residual risk has not been assessed. */
export function residualLevel(r: Risk): Level | null {
  const s = residualScore(r);
  return s == null ? null : (riskLevel(s)[0] as Level);
}
export const assetCriticality = (a: Asset): Level => criticality(assetValue(a))[0] as Level;

export function daysOverdue(dateIso: string): number {
  if (!dateIso) return 0;
  const diff = new Date(today()).getTime() - new Date(dateIso).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}
export function daysUntil(dateIso: string): number | null {
  if (!dateIso) return null;
  return Math.round((new Date(dateIso).getTime() - new Date(today()).getTime()) / 86400000);
}

/** Departments a risk touches, via its assets. */
export function riskDepartments(r: Risk, assetById: Map<string, Asset>): string[] {
  const set = new Set<string>();
  r.assetIds.forEach((id) => {
    const a = assetById.get(id);
    if (a?.department) set.add(a.department);
  });
  return [...set];
}

export const indexAssets = (assets: Asset[]): Map<string, Asset> =>
  new Map(assets.map((a) => [a.id, a]));

// ── Headline KPIs ─────────────────────────────────────────────────────────────
export interface Headline {
  criticalResidual: number;
  overdueTreatments: number;
  highValueAssets: number;
  lowCoverageHighValue: number;
  complianceScore: number;
  openIncidents: number;
  openCriticalHigh: number;
}

/** Asset ids that have at least one treatment (via any risk that references them). */
function coveredAssetIds(risks: Risk[], treatments: Treatment[]): Set<string> {
  const treatedRiskIds = new Set<string>();
  treatments.forEach((t) => t.riskIds.forEach((id) => treatedRiskIds.add(id)));
  const covered = new Set<string>();
  risks.forEach((r) => {
    if (treatedRiskIds.has(r.id)) r.assetIds.forEach((id) => covered.add(id));
  });
  return covered;
}

export function headline(
  assets: Asset[],
  risks: Risk[],
  treatments: Treatment[],
  incidents: Incident[],
  controls: ComplianceControl[],
): Headline {
  const highValue = assets.filter((a) => assetCriticality(a) === 'High');
  const covered = coveredAssetIds(risks, treatments);
  const openInc = incidents.filter(isOpen);
  return {
    criticalResidual: risks.filter((r) => residualLevel(r) === 'Critical').length,
    overdueTreatments: treatments.filter(isOverdue).length,
    highValueAssets: highValue.length,
    lowCoverageHighValue: highValue.filter((a) => !covered.has(a.id)).length,
    complianceScore: coverage(controls),
    openIncidents: openInc.length,
    openCriticalHigh: openInc.filter((i) => i.severity === 'Critical' || i.severity === 'High').length,
  };
}

// ── CISO attention items (unified, prioritised worklist) ─────────────────────
export type Priority = 'Critical' | 'High' | 'Medium';
const PRIORITY_RANK: Record<Priority, number> = { Critical: 3, High: 2, Medium: 1 };

export interface AttentionItem {
  id: string;
  priority: Priority;
  label: string;
  source: string; // record id tag, e.g. "RSK-021"
  owner: string;
  due: string; // due date (YYYY-MM-DD) or '' when the item has none
  overdueDays: number | null; // >0 = overdue; null = no explicit due date
  moduleId: string;
}

export function buildAttentionItems(data: OverviewData): AttentionItem[] {
  const out: AttentionItem[] = [];

  data.treatments.filter(isOverdue).forEach((t) =>
    out.push({
      id: `att-trt-${t.id}`,
      priority: 'Critical',
      label: t.title || 'Treatment plan',
      source: t.riskIds[0] ? `${t.id} · ${t.riskIds[0]}` : t.id,
      owner: t.owner || '—',
      due: t.dueDate,
      overdueDays: daysOverdue(t.dueDate),
      moduleId: 'treatment-catalogue',
    }),
  );

  data.incidents
    .filter((i) => isOpen(i) && (i.severity === 'Critical' || i.severity === 'High'))
    .forEach((i) =>
      out.push({
        id: `att-inc-${i.id}`,
        priority: i.severity === 'Critical' ? 'Critical' : 'High',
        label: i.shortDesc,
        source: i.id,
        owner: i.responsible || '—',
        due: '',
        overdueDays: null,
        moduleId: 'incidents',
      }),
    );

  data.risks
    .filter((r) => residualLevel(r) === 'Critical')
    .forEach((r) =>
      out.push({
        id: `att-rsk-${r.id}`,
        priority: 'High',
        label: r.threat,
        source: r.id,
        owner: r.owner || '—',
        due: '',
        overdueDays: null,
        moduleId: 'risk-catalogue',
      }),
    );

  // SLA-breached vulnerabilities — Critical when the vuln itself is
  // Critical/High severity, otherwise High.
  data.vulns.filter(slaBreached).forEach((v) =>
    out.push({
      id: `att-vul-${v.id}`,
      priority: v.severity === 'Critical' || v.severity === 'High' ? 'Critical' : 'High',
      label: `SLA breach: ${v.title}`,
      source: v.id,
      owner: v.owner || '—',
      due: slaDeadline(v),
      overdueDays: Math.abs(slaDaysLeft(v) ?? 0),
      moduleId: 'vulns',
    }),
  );

  // Overdue audit/regulator findings — Critical when the finding itself is
  // Critical/High severity, otherwise High.
  data.findings.filter(findingOverdue).forEach((f) =>
    out.push({
      id: `att-fnd-${f.id}`,
      priority: f.severity === 'Critical' || f.severity === 'High' ? 'Critical' : 'High',
      label: `${f.source}: ${f.title}`,
      source: f.id,
      owner: f.owner || '—',
      due: f.dueDate,
      overdueDays: findingOverdueDays(f),
      moduleId: 'findings',
    }),
  );

  data.accessReviews.filter(accessOverdue).forEach((a) =>
    out.push({
      id: `att-acr-${a.id}`,
      priority: 'High',
      label: a.campaign,
      source: a.id,
      owner: a.reviewer || '—',
      due: a.due,
      overdueDays: daysOverdue(a.due),
      moduleId: 'access-reviews',
    }),
  );

  data.vendors
    .filter((v) => v.contractExpiry && v.contractExpiry < today())
    .forEach((v) =>
      out.push({
        id: `att-ven-${v.id}`,
        priority: 'High',
        label: `${v.name} — contract lapsed`,
        source: v.id,
        owner: '—',
        due: v.contractExpiry,
        overdueDays: daysOverdue(v.contractExpiry),
        moduleId: 'vendors',
      }),
    );

  data.policies
    .filter((p) => p.status !== 'Retired' && (daysToReview(p.nextReview) ?? 1) < 0)
    .forEach((p) =>
      out.push({
        id: `att-pol-${p.id}`,
        priority: 'Medium',
        label: `Review overdue: ${p.title}`,
        source: p.id,
        owner: p.owner || '—',
        due: p.nextReview,
        overdueDays: daysOverdue(p.nextReview),
        moduleId: 'policies',
      }),
    );

  data.kpis
    .filter((k) => rag(k) === 'crit')
    .forEach((k) =>
      out.push({
        id: `att-kpi-${k.id}`,
        priority: 'Medium',
        label: `${k.name} off track`,
        source: k.id,
        owner: '—',
        due: '',
        overdueDays: null,
        moduleId: 'kpis',
      }),
    );

  data.courses.filter(courseOverdue).forEach((c) =>
    out.push({
      id: `att-trn-${c.id}`,
      priority: 'Medium',
      label: `Training overdue: ${c.course}`,
      source: c.id,
      owner: c.audience || '—',
      due: c.due,
      overdueDays: daysOverdue(c.due),
      moduleId: 'awareness',
    }),
  );

  return out.sort((a, b) => {
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    return (b.overdueDays ?? -1) - (a.overdueDays ?? -1);
  });
}

// ── Residual heat map (impact × likelihood counts) ───────────────────────────
/** matrix[impact-1][likelihood-1] = count of ASSESSED residual risks in that cell. */
export function residualHeatmap(risks: Risk[]): number[][] {
  const m: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  risks.forEach((r) => {
    if (r.resImpact != null && r.resLikelihood != null) {
      m[r.resImpact - 1][r.resLikelihood - 1] += 1;
    }
  });
  return m;
}

// ── Risks by department (stacked) ────────────────────────────────────────────
export interface DeptDist {
  dept: string;
  critical: number;
  high: number;
  medlow: number;
  total: number;
}

export function risksByDepartment(
  risks: Risk[],
  assetById: Map<string, Asset>,
  topN = 7,
): DeptDist[] {
  const map = new Map<string, DeptDist>();
  risks.forEach((r) => {
    const level = effectiveLevel(r);
    riskDepartments(r, assetById).forEach((dept) => {
      const d = map.get(dept) ?? { dept, critical: 0, high: 0, medlow: 0, total: 0 };
      if (level === 'Critical') d.critical += 1;
      else if (level === 'High') d.high += 1;
      else d.medlow += 1;
      d.total += 1;
      map.set(dept, d);
    });
  });
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, topN);
}

// ── Top residual risks ───────────────────────────────────────────────────────
export type Trend = 'up' | 'down' | 'flat';
export interface TopResidual {
  id: string;
  assetId: string;
  score: number;
  level: Level;
  trend: Trend; // residual vs inherent: down = improved, up = worsened
}

export function topResidualRisks(risks: Risk[], n = 5): TopResidual[] {
  return risks
    .filter((r) => residualScore(r) != null)
    .map((r) => {
      const res = residualScore(r) as number;
      const inh = inherentScore(r);
      return {
        id: r.id,
        assetId: r.assetIds[0] ?? '—',
        score: res,
        level: riskLevel(res)[0] as Level,
        trend: (res < inh ? 'down' : res > inh ? 'up' : 'flat') as Trend,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// ── Overdue treatments ───────────────────────────────────────────────────────
export interface OverdueTreatmentRow {
  id: string;
  riskId: string;
  due: string;
  overdueDays: number;
}

export function overdueTreatmentRows(treatments: Treatment[], n = 6): OverdueTreatmentRow[] {
  return treatments
    .filter(isOverdue)
    .map((t) => ({
      id: t.id,
      riskId: t.riskIds[0] ?? '—',
      due: t.dueDate,
      overdueDays: daysOverdue(t.dueDate),
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, n);
}

// ── Upcoming reviews & deadlines (forward-looking) ───────────────────────────
export interface UpcomingItem {
  id: string;
  icon: string;
  title: string;
  subtext: string;
  date: string;
  days: number; // days until (negative = overdue)
  moduleId: string;
}

/** Deadlines within `horizonDays` ahead (also surfaces items up to 30d overdue). */
export function buildUpcoming(data: OverviewData, horizonDays: number): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  const push = (i: Omit<UpcomingItem, 'days'> & { date: string }) => {
    const days = daysUntil(i.date);
    if (days == null) return;
    if (days > horizonDays || days < -30) return;
    items.push({ ...i, days });
  };

  data.policies
    .filter((p) => p.status !== 'Retired' && p.nextReview)
    .forEach((p) =>
      push({ id: `up-pol-${p.id}`, icon: 'doc', title: `Review: ${p.title}`, subtext: `${p.type} · ${p.owner || 'Unassigned'}`, date: p.nextReview, moduleId: 'policies' }),
    );

  data.accessReviews
    .filter((a) => a.progress < 100 && a.due)
    .forEach((a) =>
      push({ id: `up-acr-${a.id}`, icon: 'key', title: `Access Review – ${a.campaign}`, subtext: `${a.scope} · ${a.progress}% done`, date: a.due, moduleId: 'access-reviews' }),
    );

  data.vendors
    .filter((v) => v.contractExpiry)
    .forEach((v) =>
      push({ id: `up-ven-${v.id}`, icon: 'building', title: `${v.name} — contract renewal`, subtext: `${v.criticality} vendor`, date: v.contractExpiry, moduleId: 'vendors' }),
    );

  data.meetings
    .filter((m) => m.status === 'Scheduled' && m.date)
    .forEach((m) =>
      push({ id: `up-mtg-${m.id}`, icon: 'users', title: m.title, subtext: 'Committee meeting', date: m.date, moduleId: 'committee' }),
    );

  data.courses
    .filter((c) => c.completion < 100 && c.due)
    .forEach((c) =>
      push({ id: `up-trn-${c.id}`, icon: 'grad', title: c.course, subtext: `${c.audience} · ${c.completion}% done`, date: c.due, moduleId: 'awareness' }),
    );

  data.findings
    .filter((f) => isOpenFinding(f) && f.dueDate)
    .forEach((f) =>
      push({ id: `up-fnd-${f.id}`, icon: 'edit', title: `Finding: ${f.title}`, subtext: `${f.source} · ${f.owner || 'Unassigned'}`, date: f.dueDate, moduleId: 'findings' }),
    );

  data.vulns
    .filter((v) => isOpenVuln(v) && v.discovered)
    .forEach((v) =>
      push({ id: `up-vul-${v.id}`, icon: 'alert', title: `Vuln SLA: ${v.title}`, subtext: `${v.severity} · ${v.owner || 'Unassigned'}`, date: slaDeadline(v), moduleId: 'vulns' }),
    );

  return items.sort((a, b) => a.days - b.days);
}
