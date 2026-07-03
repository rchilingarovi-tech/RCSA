import { useStore } from '../../state/AppStore';

// At-a-glance row of the dashboard's active filters — slicer selections AND the
// chart facet — each removable, so you always see (and can drop) what's applied.
interface Pill {
  label: string;
  onRemove: () => void;
}

export function ActiveFilterBar() {
  const store = useStore();
  const af = store.assetFilters;
  const rf = store.riskFilters;

  const pills: Pill[] = [];
  if (af.department) pills.push({ label: `Dept: ${af.department}`, onRemove: () => store.patchAssetFilters({ department: '' }) });
  if (af.criticality) pills.push({ label: `Criticality: ${af.criticality}`, onRemove: () => store.patchAssetFilters({ criticality: '' }) });
  if (rf.level) pills.push({ label: `Risk level: ${rf.level}`, onRemove: () => store.patchRiskFilters({ level: '' }) });
  if (rf.status) pills.push({ label: `Status: ${rf.status}`, onRemove: () => store.patchRiskFilters({ status: '' }) });
  if (store.globalFilter) pills.push({ label: store.globalFilter.label, onRemove: () => store.dismissGlobalFilter() });

  if (pills.length === 0) return null;

  const clearAll = () => {
    store.clearGlobalFilter(); // clears asset filters + facet + selection
    store.patchRiskFilters({ level: '', status: '', assessment: '' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtered by</span>
      {pills.map((p, i) => (
        <span key={i} className="badge bg-blue-100 text-blue-800 inline-flex items-center gap-1.5">
          {p.label}
          <button onClick={p.onRemove} className="font-bold hover:opacity-70" aria-label={`Remove ${p.label}`}>✕</button>
        </span>
      ))}
      {pills.length > 1 && (
        <button onClick={clearAll} className="text-xs font-semibold text-red-500 hover:underline ml-1">Clear all</button>
      )}
    </div>
  );
}
