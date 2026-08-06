import { useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { Pill } from '../../components/common/Pill';
import { StatStrip, type Stat } from '../../components/common/StatStrip';
import { rowActivation } from '../../lib/a11y';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useTableSort } from '../../components/common/useTableSort';
import {
  ChartGrid,
  ChartPanel,
  DonutChart,
  HBarChart,
  useChartFilter,
  type BarRow,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { assetValue, criticality, today } from '../../domain/scoring';
import { exportAssetsCsv } from '../../csv/export';
import type { Asset, DataClass } from '../../data/models';

// Asset Catalogue — SentinelGRC visual design ported onto OUR existing asset model
// and shared store. Add / edit / delete / summary still flow through ModalsProvider,
// so audit diffs and RBAC keep working exactly as before. The protected Risk /
// Treatment modules and the shared data layer are untouched.

// Small inline search icon.
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
);

const CRIT_TONE: Record<string, Tone> = { High: 'crit', Medium: 'med', Low: 'low' };
const CRIT_ORDER = ['High', 'Medium', 'Low'] as const;

const CLASSES: DataClass[] = ['Public', 'Internal', 'Confidential', 'Personal Data', 'Payment Data'];
const CLS_TONE: Record<DataClass, Tone> = {
  Public: 'mut',
  Internal: 'info',
  Confidential: 'med',
  'Personal Data': 'high',
  'Payment Data': 'crit',
};

const FLAGS: { label: string; has: (a: Asset) => boolean }[] = [
  { label: 'Internet-facing', has: (a) => a.internet === 'Yes' },
  { label: 'PCI', has: (a) => a.pci === 'Yes' },
  { label: 'Third-party', has: (a) => a.thirdParty === 'Yes' },
  { label: 'Cloud', has: (a) => a.cloud === 'Yes' },
  { label: 'Critical process', has: (a) => a.criticalProcess === 'Yes' },
];

const statusTone = (s: Asset['status']): Tone => (s === 'Approved' ? 'low' : s === 'Needs Update' ? 'med' : 'mut');

export function AssetCataloguePage() {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('asset-catalogue');
  const filter = useChartFilter<Asset>();
  const [q, setQ] = useState('');

  const assets = store.assets;
  const critLabel = (a: Asset) => criticality(assetValue(a))[0];

  // ── Charts (computed live from the full dataset) ──
  const critSeg: DonutSegment[] = CRIT_ORDER.map((b) => ({
    key: `crit:${b}`, label: b, tone: CRIT_TONE[b], value: assets.filter((a) => critLabel(a) === b).length,
  }));
  const clsRows: BarRow[] = CLASSES.map((c) => ({
    key: `cls:${c}`, label: c, tone: CLS_TONE[c], value: assets.filter((a) => a.dataClass === c).length,
  }));
  const flagRows: BarRow[] = FLAGS.map((f) => ({
    key: `flag:${f.label}`, label: f.label, tone: 'high', value: assets.filter(f.has).length,
  }));

  const selectCrit = (key: string) => { const b = key.slice(5); filter.select(key, b, (a) => critLabel(a) === b); };
  const selectCls = (key: string) => { const c = key.slice(4) as DataClass; filter.select(key, c, (a) => a.dataClass === c); };
  const selectFlag = (key: string) => { const l = key.slice(5); const f = FLAGS.find((x) => x.label === l); if (f) filter.select(key, l, f.has); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  // ── Table rows: search combined with the active chart slice ──
  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assets;
    return assets.filter((a) => [a.id, a.name, a.process, a.department, a.busOwner, a.itOwner, a.dataClass].join(' ').toLowerCase().includes(s));
  }, [assets, q]);
  // Sort runs after search + chart filter, so it composes with them.
  // Default: most critical assets first.
  const { rows, sortable } = useTableSort(
    filter.apply(searched),
    {
      id: (a) => a.id,
      name: (a) => a.name,
      busOwner: (a) => a.busOwner,
      criticality: (a) => CRIT_ORDER.indexOf(critLabel(a) as (typeof CRIT_ORDER)[number]),
      dataClass: (a) => a.dataClass,
      status: (a) => a.status,
      reviewDate: (a) => a.reviewDate,
    },
    { key: 'criticality', dir: 'asc' },
    'text-left px-4 py-3',
  );
  const pager = usePaged(rows);

  const riskCount = useMemo(() => {
    const m = new Map<string, number>();
    store.risks.forEach((r) => r.assetIds.forEach((id) => m.set(id, (m.get(id) || 0) + 1)));
    return m;
  }, [store.risks]);

  const stats: Stat<Asset>[] = [
    { l: 'Assets', v: assets.length },
    { l: 'High criticality', v: assets.filter((a) => critLabel(a) === 'High').length, t: 'crit', k: 'stat:high', pred: (a) => critLabel(a) === 'High' },
    { l: 'Internet-facing', v: assets.filter((a) => a.internet === 'Yes').length, t: 'high', k: 'stat:internet', pred: (a) => a.internet === 'Yes' },
    { l: 'Reviews overdue', v: assets.filter((a) => a.reviewDate && a.reviewDate < today()).length, t: 'med', k: 'stat:revoverdue', pred: (a) => Boolean(a.reviewDate && a.reviewDate < today()) },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Stat strip */}
      <StatStrip stats={stats} filter={filter} />

      {/* Interactive charts */}
      <ChartGrid sortKey="assets-charts" collapsible>
        <ChartPanel title="Criticality distribution" span={4} filterLabel={chipFor('crit:')} onClearFilter={filter.clear}>
          <DonutChart segments={critSeg} center={String(assets.length)} sub="assets" activeKey={filter.activeKey} onSelect={selectCrit} />
        </ChartPanel>
        <ChartPanel title="By classification" span={4} filterLabel={chipFor('cls:')} onClearFilter={filter.clear}>
          <HBarChart rows={clsRows} activeKey={filter.activeKey} onSelect={selectCls} />
        </ChartPanel>
        <ChartPanel title="Exposure flags" span={4} filterLabel={chipFor('flag:')} onClearFilter={filter.clear}>
          <HBarChart rows={flagRows} activeKey={filter.activeKey} onSelect={selectFlag} />
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative" style={{ flex: '0 1 230px' }}>
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }}><SearchIcon /></span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search assets…"
            className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
        </div>
        {filter.active && (
          <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--link)', borderColor: 'var(--accent)' }}>
            Filtered: {filter.active.label} ✕
          </button>
        )}
        <div className="flex-1" />
        {perms.export && <button onClick={() => exportAssetsCsv(rows)} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.create && <button onClick={() => modals.newAsset()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Asset</button>}
      </div>

      {/* Table */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                {sortable('id', 'Asset #')}
                {sortable('name', 'Name / Process')}
                {sortable('busOwner', 'Owners')}
                <th className="text-center px-4 py-3">C·I·A</th>
                {sortable('criticality', 'Criticality')}
                {sortable('dataClass', 'Classification')}
                {sortable('status', 'Status')}
                {sortable('reviewDate', 'Review')}
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No assets match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((a) => {
                const v = assetValue(a);
                const cl = critLabel(a);
                const rc = riskCount.get(a.id) || 0;
                const overdue = !!a.reviewDate && a.reviewDate < today();
                return (
                  <tr key={a.id} className="risk-row cursor-pointer" {...rowActivation(() => modals.openSummary(a.id), `Open ${a.id}: ${a.name}`)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--link)' }}>{a.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{a.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{a.process} · {a.department}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: 'var(--text2)' }}>{a.busOwner}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{a.itOwner}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono whitespace-nowrap" style={{ color: 'var(--text2)' }}>{a.c}·{a.i}·{a.a}</td>
                    <td className="px-4 py-3"><Pill text={`${cl} (${v})`} k={CRIT_TONE[cl]} /></td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        <Pill text={a.dataClass} k={CLS_TONE[a.dataClass]} />
                        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{rc} risk{rc !== 1 ? 's' : ''}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3"><Pill text={a.status} k={statusTone(a.status)} /></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {a.reviewDate ? (overdue ? <Pill text={`${a.reviewDate} · due`} k="crit" /> : <span style={{ color: 'var(--text2)' }}>{a.reviewDate}</span>) : '—'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <RowActions onEdit={perms.edit ? () => modals.editAsset(a.id) : undefined} onDelete={perms.remove ? () => modals.deleteAssetFlow(a.id) : undefined} editLabel="Edit asset" deleteLabel="Delete asset" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>
    </div>
  );
}
