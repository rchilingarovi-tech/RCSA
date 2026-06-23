import type { Asset, Risk } from '../data/models';
import { assetValue, criticality, riskLevel, isOverdue, effectiveStatus } from '../domain/scoring';

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

export interface AssetFilters {
  search: string;
  valuePreset: 'all' | 'low' | 'medium' | 'high' | 'custom';
  minValue: string;
  maxValue: string;
  criticality: '' | 'Low' | 'Medium' | 'High';
  pci: '' | 'Yes' | 'No';
}

export interface RiskFilters {
  level: '' | 'Low' | 'Medium' | 'High' | 'Critical';
  status: '' | 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  assessment: '' | 'Mitigate' | 'Accept' | 'Transfer' | 'Avoid';
}

export const EMPTY_ASSET_FILTERS: AssetFilters = {
  search: '',
  valuePreset: 'all',
  minValue: '',
  maxValue: '',
  criticality: '',
  pci: '',
};

export const EMPTY_RISK_FILTERS: RiskFilters = { level: '', status: '', assessment: '' };

export interface FilterContext {
  assets: Asset[];
  risks: Risk[];
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

/** Ported from getFilteredAssets (New Version.html L908-931). */
export function getFilteredAssets(ctx: FilterContext): Asset[] {
  const { assets, globalFilter, assetFilters: f } = ctx;

  if (globalFilter && globalFilter.type === 'assetCriticality') {
    return assets.filter((a) => criticality(assetValue(a))[0] === globalFilter.value);
  }

  const q = f.search.trim().toLowerCase();
  let minV: number | null = f.minValue ? Number(f.minValue) : null;
  let maxV: number | null = f.maxValue ? Number(f.maxValue) : null;
  if (f.valuePreset === 'low') { minV = 1; maxV = 6; }
  if (f.valuePreset === 'medium') { minV = 7; maxV = 19; }
  if (f.valuePreset === 'high') { minV = 20; maxV = 27; }

  return assets.filter((a) => {
    const v = assetValue(a);
    const crit = criticality(v)[0];
    const text = `${a.id} ${a.name} ${a.process} ${a.department} ${a.busOwner} ${a.itOwner}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (minV !== null && v < minV) return false;
    if (maxV !== null && v > maxV) return false;
    if (f.criticality && crit !== f.criticality) return false;
    if (f.pci && a.pci !== f.pci) return false;
    return true;
  });
}

/** Ported from getFilteredRisks (New Version.html L1367-1411). */
export function getFilteredRisks(ctx: FilterContext): Risk[] {
  const { assets, risks, selectedAssetId, globalFilter, riskFilters: f } = ctx;
  let arr: Risk[];

  if (globalFilter) {
    const g = globalFilter;
    switch (g.type) {
      case 'allRisks':
        arr = risks;
        break;
      case 'riskLevel':
        arr = risks.filter((r) => ['High', 'Critical'].includes(riskLevel(r.resImpact * r.resLikelihood)[0]));
        break;
      case 'riskStatus':
        arr = risks.filter((r) => !isOverdue(r) && r.treatmentStatus === g.value);
        break;
      case 'riskOverdue':
        arr = risks.filter(isOverdue);
        break;
      case 'riskAssessment':
        arr = risks.filter((r) => r.assessment === g.value);
        break;
      case 'riskHeat':
        arr = risks.filter((r) => r.resImpact === g.value.i && r.resLikelihood === g.value.l);
        break;
      case 'riskDept':
        arr = risks.filter((r) => {
          const a = assets.find((x) => x.id === r.assetId);
          return a && a.department === g.value;
        });
        break;
      case 'riskThreat':
        arr = risks.filter((r) => r.threat === g.value);
        break;
      case 'riskOverdueOwner':
        arr = risks.filter((r) => isOverdue(r) && (r.responsible || 'Unassigned') === g.value);
        break;
      case 'riskAcceptedDept':
        arr = risks.filter(
          (r) => r.assessment === 'Accept' && assets.find((x) => x.id === r.assetId)?.department === g.value,
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
    arr = risks.filter((r) => r.assetId === selectedAssetId);
  } else {
    return [];
  }

  return arr.filter((r) => {
    const l = riskLevel(r.resImpact * r.resLikelihood)[0];
    const status = effectiveStatus(r);
    if (f.level && l !== f.level) return false;
    if (f.status && status !== f.status) return false;
    if (f.assessment && r.assessment !== f.assessment) return false;
    return true;
  });
}
