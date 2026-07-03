import { useStore } from '../state/AppStore';

export function GlobalFilterBanner() {
  const store = useStore();
  if (!store.globalFilter) return null;

  return (
    <div className="global-filter-banner flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="gf-dot" aria-hidden />
        <div>
          <div className="gf-label">Active filter</div>
          <span className="global-filter-banner-text text-lg">{store.globalFilter.label}</span>
        </div>
      </div>
      <button onClick={() => store.clearGlobalFilter()} className="clear-filter-btn">
        ✕ Clear Filter
      </button>
    </div>
  );
}
