import { useStore } from '../../state/AppStore';
import type { AssetFilters as Filters } from '../../state/filters';

const PRESET_RANGES: Record<string, { min: string; max: string } | null> = {
  low: { min: '1', max: '6' },
  medium: { min: '7', max: '19' },
  high: { min: '20', max: '27' },
  all: { min: '', max: '' },
  custom: null,
};

export function AssetFilters() {
  const store = useStore();
  const f = store.assetFilters;

  function onPreset(value: Filters['valuePreset']) {
    const range = PRESET_RANGES[value];
    if (range) store.patchAssetFilters({ valuePreset: value, minValue: range.min, maxValue: range.max });
    else store.patchAssetFilters({ valuePreset: value });
  }

  const ctl = 'border rounded px-2 py-1.5 text-sm';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
      <input
        value={f.search}
        onChange={(e) => store.patchAssetFilters({ search: e.target.value })}
        className={`${ctl} col-span-2 md:col-span-1`}
        placeholder="Search…"
        aria-label="Search assets"
      />
      <select value={f.valuePreset} onChange={(e) => onPreset(e.target.value as Filters['valuePreset'])} className={`${ctl} bg-white`} aria-label="Value preset">
        <option value="all">All values</option>
        <option value="low">Low (1–6)</option>
        <option value="medium">Medium (7–19)</option>
        <option value="high">High (20–27)</option>
        <option value="custom">Custom range</option>
      </select>
      <input
        type="number" min={1} max={27} value={f.minValue}
        onChange={(e) => store.patchAssetFilters({ minValue: e.target.value, valuePreset: 'custom' })}
        className={ctl} placeholder="Min" aria-label="Minimum value"
      />
      <input
        type="number" min={1} max={27} value={f.maxValue}
        onChange={(e) => store.patchAssetFilters({ maxValue: e.target.value, valuePreset: 'custom' })}
        className={ctl} placeholder="Max" aria-label="Maximum value"
      />
      <select value={f.criticality} onChange={(e) => store.patchAssetFilters({ criticality: e.target.value as Filters['criticality'] })} className={`${ctl} bg-white`} aria-label="Criticality filter">
        <option value="">All criticality</option>
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
      </select>
      <select value={f.pci} onChange={(e) => store.patchAssetFilters({ pci: e.target.value as Filters['pci'] })} className={`${ctl} bg-white`} aria-label="PCI filter">
        <option value="">PCI: All</option>
        <option value="Yes">PCI: Yes</option>
        <option value="No">PCI: No</option>
      </select>
      <button onClick={() => store.clearAssetFilters()} className="btn-neutral border rounded px-2 py-1.5 text-sm hover:bg-gray-100 text-gray-600">
        Reset Locals
      </button>
    </div>
  );
}
