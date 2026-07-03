import { useMemo, type ReactNode } from 'react';
import { useStore } from '../../state/AppStore';
import type { AssetFilters, RiskFilters } from '../../state/filters';

// Compact dashboard slicer — the few dimensions that matter for a risk overview.
// Detailed asset filtering lives on the Asset Catalogue page.
const ctl = 'border rounded px-2 py-1.5 text-sm bg-white w-full';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-[150px] flex-1">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function DashboardSlicer() {
  const store = useStore();
  const af = store.assetFilters;
  const rf = store.riskFilters;

  const departments = useMemo(
    () => Array.from(new Set(store.assets.map((a) => a.department).filter(Boolean))).sort(),
    [store.assets],
  );

  const active = !!(af.department || af.criticality || rf.level || rf.status || store.globalFilter);

  const reset = () => {
    store.clearGlobalFilter(); // also clears asset filters + selection
    store.patchRiskFilters({ level: '', status: '', assessment: '' });
  };

  return (
    <div className="section-card px-5 py-3 flex flex-wrap items-end gap-3">
      <Field label="Department">
        <select value={af.department} onChange={(e) => store.patchAssetFilters({ department: e.target.value })} className={ctl}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Field>

      <Field label="Criticality">
        <select value={af.criticality} onChange={(e) => store.patchAssetFilters({ criticality: e.target.value as AssetFilters['criticality'] })} className={ctl}>
          <option value="">All criticality</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </Field>

      <Field label="Risk Level">
        <select value={rf.level} onChange={(e) => store.patchRiskFilters({ level: e.target.value as RiskFilters['level'] })} className={ctl}>
          <option value="">All levels</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
          <option>Critical</option>
        </select>
      </Field>

      <Field label="Treatment Status">
        <select value={rf.status} onChange={(e) => store.patchRiskFilters({ status: e.target.value as RiskFilters['status'] })} className={ctl}>
          <option value="">All status</option>
          <option>Open</option>
          <option>In Progress</option>
          <option>Completed</option>
          <option>Overdue</option>
        </select>
      </Field>

      <button
        onClick={reset}
        disabled={!active}
        className="btn-neutral border rounded px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Reset
      </button>
    </div>
  );
}
