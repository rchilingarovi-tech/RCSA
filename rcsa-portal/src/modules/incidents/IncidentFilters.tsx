import type { CSSProperties } from 'react';
import { INCIDENT_STATUSES, SEVERITIES, CATEGORIES, type IncidentFilter } from './types';

const controlStyle: CSSProperties = {
  height: 38,
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 9,
  color: 'var(--text)',
  fontSize: 13.5,
  padding: '0 11px',
};
const selectStyle: CSSProperties = { ...controlStyle, color: 'var(--text2)', cursor: 'pointer' };

interface Props {
  filter: IncidentFilter;
  setFilter: (f: IncidentFilter) => void;
  responsibleOptions: string[];
  shown: number;
  total: number;
}

// Top-of-page slicer — re-scopes the dashboard AND the list together (RCSA-style).
export function IncidentFilters({ filter, setFilter, responsibleOptions, shown, total }: Props) {
  const set = (patch: Partial<IncidentFilter>) => setFilter({ ...filter, ...patch });
  const active = filter.search || filter.status || filter.severity || filter.category || filter.responsible || filter.from || filter.to;

  return (
    <div className="section-card p-3.5 flex flex-wrap items-center gap-2.5">
      {/* Search with icon */}
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 190 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="7" stroke="var(--text3)" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          value={filter.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search ID or description…"
          style={{ ...controlStyle, width: '100%', padding: '0 12px 0 34px' }}
        />
      </div>

      <select value={filter.status} onChange={(e) => set({ status: e.target.value })} style={selectStyle}><option value="">All statuses</option>{INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={filter.severity} onChange={(e) => set({ severity: e.target.value })} style={selectStyle}><option value="">All severities</option>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select>
      <select value={filter.category} onChange={(e) => set({ category: e.target.value })} style={selectStyle}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <select value={filter.responsible} onChange={(e) => set({ responsible: e.target.value })} style={selectStyle}><option value="">All handlers</option>{responsibleOptions.map((r) => <option key={r}>{r}</option>)}</select>

      <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text3)' }}>
        From<input type="date" value={filter.from} onChange={(e) => set({ from: e.target.value })} style={{ ...controlStyle, fontSize: 13 }} />
      </label>
      <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text3)' }}>
        To<input type="date" value={filter.to} onChange={(e) => set({ to: e.target.value })} style={{ ...controlStyle, fontSize: 13 }} />
      </label>

      {active && (
        <button
          onClick={() => setFilter({ search: '', status: '', severity: '', category: '', responsible: '', from: '', to: '' })}
          className="text-xs font-medium"
          style={{ ...controlStyle, color: 'var(--text2)', cursor: 'pointer', padding: '0 12px' }}
        >
          Clear
        </button>
      )}

      <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--text3)' }}>
        {active ? <>Showing <b style={{ color: 'var(--text)' }}>{shown}</b> of {total}</> : <><b style={{ color: 'var(--text)' }}>{total}</b> incidents</>}
      </span>
    </div>
  );
}
