import { useMemo, type ReactNode } from 'react';
import { useStore } from '../../state/AppStore';
import { getFilteredAssets, EMPTY_ASSET_FILTERS, type AssetFilters as Filters } from '../../state/filters';
import { DATA_CLASSES, ASSET_STATUSES } from '../../domain/constants';

// The Yes/No asset attributes — rendered as identical Any/Yes/No selects.
const YESNO_FIELDS: { key: keyof Filters; label: string }[] = [
  { key: 'pci', label: 'PCI' },
  { key: 'criticalProcess', label: 'Critical Process' },
  { key: 'internet', label: 'Internet Facing' },
  { key: 'thirdParty', label: 'Third Party' },
  { key: 'cloud', label: 'Cloud' },
];

const ctl = 'border rounded px-2 py-1.5 text-sm bg-white w-full';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  );
}

export function AssetFilters() {
  const store = useStore();
  const f = store.assetFilters;

  // Department options derived from the live data set (sorted, de-duplicated).
  const departments = useMemo(
    () => Array.from(new Set(store.assets.map((a) => a.department).filter(Boolean))).sort(),
    [store.assets],
  );

  const filteredCount = useMemo(
    () =>
      getFilteredAssets({
        assets: store.assets,
        risks: store.risks,
        treatments: store.treatments,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }).length,
    [store.assets, store.risks, store.selectedAssetId, store.globalFilter, store.assetFilters, store.riskFilters],
  );

  // Count active (non-default) filters for the "N active" hint.
  const activeCount = useMemo(() => {
    let n = 0;
    (Object.keys(EMPTY_ASSET_FILTERS) as (keyof Filters)[]).forEach((k) => {
      if (k === 'valuePreset') {
        if (f.valuePreset !== 'all') n += 1;
      } else if (f[k] !== EMPTY_ASSET_FILTERS[k]) {
        n += 1;
      }
    });
    return n;
  }, [f]);

  return (
    <div className="section-card">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-gray-800">Asset Filters</h2>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <span className="font-semibold text-gray-700">{filteredCount}</span> of {store.assets.length} assets
            {activeCount > 0 && (
              <span className="ml-2 text-gray-400">· {activeCount} filter{activeCount !== 1 ? 's' : ''} active</span>
            )}
          </span>
          <button
            onClick={() => store.clearAssetFilters()}
            disabled={activeCount === 0}
            className="btn-neutral border rounded px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Field label="Search">
          <input
            value={f.search}
            onChange={(e) => store.patchAssetFilters({ search: e.target.value })}
            className={ctl}
            placeholder="Name, owner, process, notes…"
            aria-label="Search assets"
          />
        </Field>

        <Field label="Department">
          <select value={f.department} onChange={(e) => store.patchAssetFilters({ department: e.target.value })} className={ctl}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Data Class">
          <select value={f.dataClass} onChange={(e) => store.patchAssetFilters({ dataClass: e.target.value as Filters['dataClass'] })} className={ctl}>
            <option value="">All data classes</option>
            {DATA_CLASSES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select value={f.status} onChange={(e) => store.patchAssetFilters({ status: e.target.value as Filters['status'] })} className={ctl}>
            <option value="">All statuses</option>
            {ASSET_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Criticality">
          <select value={f.criticality} onChange={(e) => store.patchAssetFilters({ criticality: e.target.value as Filters['criticality'] })} className={ctl}>
            <option value="">All criticality</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </Field>

        <Field label="Value range">
          <select value={f.valuePreset} onChange={(e) => store.patchAssetFilters({ valuePreset: e.target.value as Filters['valuePreset'] })} className={ctl}>
            <option value="all">All values</option>
            <option value="low">Low (1–6)</option>
            <option value="medium">Medium (7–19)</option>
            <option value="high">High (20–27)</option>
          </select>
        </Field>

        {YESNO_FIELDS.map(({ key, label }) => (
          <Field key={key} label={label}>
            <select
              value={f[key] as string}
              onChange={(e) => store.patchAssetFilters({ [key]: e.target.value } as Partial<Filters>)}
              className={ctl}
              aria-label={`${label} filter`}
            >
              <option value="">Any</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </Field>
        ))}
      </div>
    </div>
  );
}
