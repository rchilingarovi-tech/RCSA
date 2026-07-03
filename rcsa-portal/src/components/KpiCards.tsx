import { useMemo } from 'react';
import { useStore } from '../state/AppStore';
import { getDashboardScope } from '../state/filters';
import { assetValue, criticality, riskLevel, residualScore, isOverdue } from '../domain/scoring';

export function KpiCards() {
  const store = useStore();

  // Read-only, but reflects the dashboard's cross-filter slice.
  const { assets, risks, treatments } = useMemo(
    () =>
      getDashboardScope({
        assets: store.assets,
        risks: store.risks,
        treatments: store.treatments,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }),
    [store.assets, store.risks, store.treatments, store.selectedAssetId, store.globalFilter, store.assetFilters, store.riskFilters],
  );

  const stats = useMemo(() => {
    const highAssets = assets.filter((a) => criticality(assetValue(a))[0] === 'High').length;
    const highRisks = risks.filter((r) => { const s = residualScore(r); return s != null && ['High', 'Critical'].includes(riskLevel(s)[0]); }).length;
    const accepted = risks.filter((r) => r.assessment === 'Accept').length;
    const overdue = treatments.filter(isOverdue).length;
    const completed = treatments.filter((t) => t.status === 'Completed').length;
    return { highAssets, highRisks, accepted, overdue, completed };
  }, [assets, risks, treatments]);

  // Read-only informative summary (scoped to the current view). Not interactive —
  // the charts are the cross-filter controls. `accent` colours the top border in
  // the classic theme (ignored by glass, which has --kpi-top-width: 0).
  const cards: { label: string; val: number; cls: string; accent: string }[] = [
    { label: 'Total Assets', val: assets.length, cls: 'text-blue-700', accent: '#3b82f6' },
    { label: 'High-Value Assets', val: stats.highAssets, cls: 'text-red-600', accent: '#f59e0b' },
    { label: 'Total Risks', val: risks.length, cls: 'text-gray-700', accent: '#3b82f6' },
    { label: 'High / Critical', val: stats.highRisks, cls: 'text-red-600', accent: '#ef4444' },
    { label: 'Accepted Risks', val: stats.accepted, cls: 'text-orange-600', accent: '#f59e0b' },
    { label: 'Overdue Plans', val: stats.overdue, cls: stats.overdue > 0 ? 'text-red-700' : 'text-gray-700', accent: '#f59e0b' },
    { label: 'Completed Plans', val: stats.completed, cls: 'text-green-700', accent: '#22c55e' },
  ];

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))' }}>
      {cards.map((c) => (
        <div
          key={c.label}
          className="dashboard-card kpi-card rounded-lg p-3"
          style={{ ['--kpi-accent' as string]: c.accent }}
        >
          <div className="text-xs text-gray-500 leading-tight">{c.label}</div>
          <div className={`text-2xl font-bold ${c.cls} mt-0.5`}>{c.val}</div>
        </div>
      ))}
    </div>
  );
}
