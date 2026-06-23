import { useStore } from '../state/AppStore';

export function GlobalFilterBanner() {
  const store = useStore();
  if (!store.globalFilter) return null;

  return (
    <div className="global-filter-banner flex items-center justify-between shadow-sm">
      <div>
        <span className="text-sm text-gray-600">Currently viewing: </span>
        <span className="global-filter-banner-text text-lg">{store.globalFilter.label}</span>
      </div>
      <button
        onClick={() => store.clearGlobalFilter()}
        className="btn-neutral bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-50 font-semibold shadow-sm"
      >
        Clear Global Filter
      </button>
    </div>
  );
}
