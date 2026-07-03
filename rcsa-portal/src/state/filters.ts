import type { Asset, Risk, Treatment, DataClass, AssetStatus, YesNo } from '../data/models';
import { assetValue, criticality, riskLevel, residualScore, riskStatus, riskOverdue, treatmentsForRisk, isOverdue } from '../domain/scoring';

/** Residual risk level label, or null when residual hasn't been assessed. */
const resLevelOf = (r: Risk): string | null => {
  const s = residualScore(r);
  return s == null ? null : riskLevel(s)[0];
};

// ── Global cross-filter (discriminated union over the prototype's filter types) ──
export type GlobalFilter =
  | { type: 'assetCriticality'; value: string; label: string }
  | { type: 'allRisks'; value: 'all'; label: string }
  | { type: 'riskLevel'; value: 'HighOrCritical'; label: string }
  | { type: 'riskStatus'; value: string; label: string }
  | { type: 'riskOverdue'; value: true; label: string }
  | { type: 'riskAssessment'; value: string; label: string }
  | { type: 'riskHeat'; value: { i: number; l: number }; label: string }
  | { type: 'riskDept'; value: string; label: string }
  | { type: 'riskThreat'; value: string; label: string }
  | { type: 'riskOverdueOwner'; value: string; label: string }
  | { type: 'riskAcceptedDept'; value: string; label: string }
  | { type: 'riskControlCount'; value: 0 | 1 | 2; label: string };

export type YesNoFilter = '' | YesNo;

export interface AssetFilters {
  search: string;
  valuePreset: 'all' | 'low' | 'medium' | 'high';
  criticality: '' | 'Low' | 'Medium' | 'High';
  department: string;
  dataClass: '' | DataClass;
  status: '' | AssetStatus;
  pci: YesNoFilter;
  criticalProcess: YesNoFilter;
  internet: YesNoFilter;
  thirdParty: YesNoFilter;
  cloud: YesNoFilter;
}

export interface RiskFilters {
  level: '' | 'Low' | 'Medium' | 'High' | 'Critical';
  status: '' | 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  assessment: '' | 'Mitigate' | 'Accept' | 'Transfer' | 'Avoid';
}

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  search: '',
  valuePreset: 'all',
  criticality: '',
  department: '',
  dataClass: '',
  status: '',
  pci: '',
  criticalProcess: '',
  internet: '',
  thirdParty: '',
  cloud: '',
};

export const EMPTY_RISK_FILTERS: RiskFilters = { level: '', status: '', assessment: '' };

export interface FilterContext {
  assets: Asset[];
  risks: Risk[];
  treatments: Treatment[];
  selectedAssetId: string | null;
  globalFilter: GlobalFilter | null;
  assetFilters: AssetFilters;
  riskFilters: RiskFilters;
}

/** Whether the risk register section should be visible. */
export function isRiskSectionVisible(ctx: Pick<FilterContext, 'selectedAssetId' | 'globalFilter'>): boolean {
  if (ctx.selectedAssetId) return true;
  if (ctx.globalFilter && ctx.globalFilter.type !== 'assetCriticality') return true;
  return false;
}

const VALUE_PRESETS: Record<AssetFilters['valuePreset'], [number, number] | null> = {
  all: null,
  low: [1, 6],
  medium: [7, 19],
  high: [20, 27],
};

/**
 * Pure local asset filtering (the filter panel). Shared by the catalog table and
 * the dashboard so KPIs/charts reflect the same scope. Does NOT consider the
 * global cross-filter — that's a drill-down handled in getFilteredAssets.
 */
export function applyAssetFilters(assets: Asset[], f: AssetFilters): Asset[] {
  const q = f.search.trim().toLowerCase();
  const range = VALUE_PRESETS[f.valuePreset];

  return assets.filter((a) => {
    const v = assetValue(a);
    const crit = criticality(v)[0];
    const text =
      `${a.id} ${a.name} ${a.process} ${a.department} ${a.busOwner} ${a.itOwner} ${a.applicantName} ${a.dataClass} ${a.status} ${a.notes}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (range && (v < range[0] || v > range[1])) return false;
    if (f.criticality && crit !== f.criticality) return false;
    if (f.department && a.department !== f.department) return false;
    if (f.dataClass && a.dataClass !== f.dataClass) return false;
    if (f.status && a.status !== f.status) return false;
    if (f.pci && a.pci !== f.pci) return false;
    if (f.criticalProcess && a.criticalProcess !== f.criticalProcess) return false;
    if (f.internet && a.internet !== f.internet) return false;
    if (f.thirdParty && a.thirdParty !== f.thirdParty) return false;
    if (f.cloud && a.cloud !== f.cloud) return false;
    return true;
  });
}

/** Risks belonging to the given asset set — used to scope dashboard data. */
export function risksForAssets(risks: Risk[], assets: Asset[]): Risk[] {
  const ids = new Set(assets.map((a) => a.id));
  return risks.filter((r) => r.assetIds.some((id) => ids.has(id)));
}

/** Ported from getFilteredAssets (New Version.html L908-931). */
export function getFilteredAssets(ctx: FilterContext): Asset[] {
  const { assets, globalFilter, assetFilters: f } = ctx;

  if (globalFilter && globalFilter.type === 'assetCriticality') {
    return assets.filter((a) => criticality(assetValue(a))[0] === globalFilter.value);
  }

  return applyAssetFilters(assets, f);
}

/** Whether a risk matches the active global cross-filter (risk-centric types). */
function matchesGlobalRisk(r: Risk, g: GlobalFilter, assets: Asset[], treatments: Treatment[]): boolean {
  const deptOf = (id: string) => assets.find((a) => a.id === id)?.department;
  const inDept = (dept: string) => r.assetIds.some((id) => deptOf(id) === dept);
  switch (g.type) {
    case 'allRisks':
      return true;
    case 'riskLevel': {
      const l = resLevelOf(r);
      return l != null && ['High', 'Critical'].includes(l);
    }
    case 'riskStatus':
      return riskStatus(r, treatments) === g.value;
    case 'riskOverdue':
      return riskOverdue(r, treatments);
    case 'riskAssessment':
      return r.assessment === g.value;
    case 'riskHeat':
      return r.resImpact === g.value.i && r.resLikelihood === g.value.l;
    case 'riskDept':
      return inDept(g.value);
    case 'riskThreat':
      return r.threat === g.value;
    case 'riskOverdueOwner':
      // Risks that have an overdue treatment owned by the given owner.
      return treatmentsForRisk(treatments, r.id).some(
        (t) => isOverdue(t) && (t.owner || 'Unassigned') === g.value,
      );
    case 'riskAcceptedDept':
      return r.assessment === 'Accept' && inDept(g.value);
    case 'riskControlCount': {
      const c = r.controls.length;
      if (g.value === 0) return c === 0;
      if (g.value === 1) return c >= 1 && c <= 2;
      return c >= 3;
    }
    default:
      return true; // assetCriticality is handled at the asset level
  }
}

/**
 * Data set that drives the KPIs and charts. Applies the asset filter panel, then
 * narrows to the active global cross-filter so clicking any dashboard item
 * re-scopes every dashboard together.
 */
export function getDashboardScope(
  ctx: FilterContext,
): { assets: Asset[]; risks: Risk[]; treatments: Treatment[] } {
  const baseAssets = applyAssetFilters(ctx.assets, ctx.assetFilters);
  const g = ctx.globalFilter;
  const allTreatments = ctx.treatments;

  let assets = baseAssets;
  let risks = risksForAssets(ctx.risks, baseAssets);

  if (g && g.type === 'assetCriticality') {
    assets = baseAssets.filter((a) => criticality(assetValue(a))[0] === g.value);
    risks = risksForAssets(ctx.risks, assets);
  } else if (g) {
    // Risk-centric facet: keep matching risks, scope assets to those they belong to.
    risks = risks.filter((r) => matchesGlobalRisk(r, g, ctx.assets, allTreatments));
    const ids = new Set(risks.flatMap((r) => r.assetIds));
    assets = baseAssets.filter((a) => ids.has(a.id));
  }

  // Risk-dimension slicers (level / status rollup) from the dashboard slicer.
  const f = ctx.riskFilters;
  risks = risks.filter((r) => {
    if (f.level && resLevelOf(r) !== f.level) return false;
    if (f.status && riskStatus(r, allTreatments) !== f.status) return false;
    return true;
  });

  // Treatments in scope = those addressing any risk in the final set.
  const riskIds = new Set(risks.map((r) => r.id));
  const treatments = allTreatments.filter((t) => t.riskIds.some((id) => riskIds.has(id)));

  return { assets, risks, treatments };
}

/**
 * Risk Catalogue page: ALL risks by default, narrowed by the active global
 * cross-filter (from the dashboard) and the page's own risk filters. Unlike
 * getFilteredRisks it does not require a selected asset.
 */
export function getCatalogueRisks(ctx: FilterContext): Risk[] {
  const { assets, risks, treatments, globalFilter, riskFilters: f } = ctx;
  let arr = risks;
  if (globalFilter) {
    if (globalFilter.type === 'assetCriticality') {
      const ids = new Set(
        assets.filter((a) => criticality(assetValue(a))[0] === globalFilter.value).map((a) => a.id),
      );
      arr = risks.filter((r) => r.assetIds.some((id) => ids.has(id)));
    } else {
      arr = risks.filter((r) => matchesGlobalRisk(r, globalFilter, assets, treatments));
    }
  }
  return arr.filter((r) => {
    const l = resLevelOf(r);
    const status = riskStatus(r, treatments);
    if (f.level && l !== f.level) return false;
    if (f.status && status !== f.status) return false;
    if (f.assessment && r.assessment !== f.assessment) return false;
    return true;
  });
}

/** Ported from getFilteredRisks (New Version.html L1367-1411). */
export function getFilteredRisks(ctx: FilterContext): Risk[] {
  const { assets, risks, treatments, selectedAssetId, globalFilter, riskFilters: f } = ctx;
  let arr: Risk[];

  if (globalFilter) {
    const g = globalFilter;
    switch (g.type) {
      case 'allRisks':
        arr = risks;
        break;
      case 'riskLevel':
        arr = risks.filter((r) => { const l = resLevelOf(r); return l != null && ['High', 'Critical'].includes(l); });
        break;
      case 'riskStatus':
        arr = risks.filter((r) => riskStatus(r, treatments) === g.value);
        break;
      case 'riskOverdue':
        arr = risks.filter((r) => riskOverdue(r, treatments));
        break;
      case 'riskAssessment':
        arr = risks.filter((r) => r.assessment === g.value);
        break;
      case 'riskHeat':
        arr = risks.filter((r) => r.resImpact === g.value.i && r.resLikelihood === g.value.l);
        break;
      case 'riskDept':
        arr = risks.filter((r) =>
          r.assetIds.some((id) => assets.find((x) => x.id === id)?.department === g.value),
        );
        break;
      case 'riskThreat':
        arr = risks.filter((r) => r.threat === g.value);
        break;
      case 'riskOverdueOwner':
        arr = risks.filter((r) =>
          treatmentsForRisk(treatments, r.id).some((t) => isOverdue(t) && (t.owner || 'Unassigned') === g.value),
        );
        break;
      case 'riskAcceptedDept':
        arr = risks.filter(
          (r) =>
            r.assessment === 'Accept' &&
            r.assetIds.some((id) => assets.find((x) => x.id === id)?.department === g.value),
        );
        break;
      case 'riskControlCount':
        arr = risks.filter((r) => {
          const c = r.controls.length;
          if (g.value === 0) return c === 0;
          if (g.value === 1) return c >= 1 && c <= 2;
          return c >= 3;
        });
        break;
      default:
        arr = risks;
    }
  } else if (selectedAssetId) {
    arr = risks.filter((r) => r.assetIds.includes(selectedAssetId));
  } else {
    return [];
  }

  return arr.filter((r) => {
    const l = resLevelOf(r);
    const status = riskStatus(r, treatments);
    if (f.level && l !== f.level) return false;
    if (f.status && status !== f.status) return false;
    if (f.assessment && r.assessment !== f.assessment) return false;
    return true;
  });
}
