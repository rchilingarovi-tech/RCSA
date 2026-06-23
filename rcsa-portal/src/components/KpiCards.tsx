import { useMemo } from 'react';
import { useStore } from '../state/AppStore';
import { assetValue, criticality, riskLevel, residualScore, isOverdue } from '../domain/scoring';

export function KpiCards() {
  const store = useStore();
  const { assets, risks } = store;

  const stats = useMemo(() => {
    const highAssets = assets.filter((a) => criticality(assetValue(a))[0] === 'High').length;
    const highRisks = risks.filter((r) => ['High', 'Critical'].includes(riskLevel(residualScore(r))[0])).length;
    const accepted = risks.filter((r) => r.assessment === 'Accept').length;
    const overdue = risks.filter(isOverdue).length;
    const completed = risks.filter((r) => r.treatmentStatus === 'Completed').length;
    return { highAssets, highRisks, accepted, overdue, completed };
  }, [assets, risks]);

  // tip → cross-filter action (ported from dashFilter L638-646)
  function dashFilter(tip: string) {
    switch (tip) {
      case 'all': store.clearGlobalFilter(); break;
      case 'high-assets': store.setGlobalFilter({ type: 'assetCriticality', value: 'High', label: 'High-Value Assets' }); break;
      case 'all-risks': store.setGlobalFilter({ type: 'allRisks', value: 'all', label: 'All Global Risks' }); break;
      case 'high-risks': store.setGlobalFilter({ type: 'riskLevel', value: 'HighOrCritical', label: 'High / Critical Risks' }); break;
      case 'accepted': store.setGlobalFilter({ type: 'riskAssessment', value: 'Accept', label: 'Accepted Risks' }); break;
      case 'overdue': store.setGlobalFilter({ type: 'riskOverdue', value: true, label: 'Overdue Plans' }); break;
      case 'completed': store.setGlobalFilter({ type: 'riskStatus', value: 'Completed', label: 'Completed Plans' }); break;
    }
  }

  const cards: { label: string; val: number; cls: string; tip: string }[] = [
    { label: 'Total Assets', val: assets.length, cls: 'text-blue-700', tip: 'all' },
    { label: 'High-Value Assets', val: stats.highAssets, cls: 'text-red-600', tip: 'high-assets' },
    { label: 'Total Risks', val: risks.length, cls: 'text-gray-700', tip: 'all-risks' },
    { label: 'High / Critical', val: stats.highRisks, cls: 'text-red-600', tip: 'high-risks' },
    { label: 'Accepted Risks', val: stats.accepted, cls: 'text-orange-600', tip: 'accepted' },
    { label: 'Overdue Plans', val: stats.overdue, cls: stats.overdue > 0 ? 'text-red-700' : 'text-gray-700', tip: 'overdue' },
    { label: 'Completed Plans', val: stats.completed, cls: 'text-green-700', tip: 'completed' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={() => dashFilter(c.tip)}
          className="dashboard-card bg-white rounded-lg shadow p-3 cursor-pointer hover:shadow-md transition text-left"
        >
          <div className="text-xs text-gray-500 leading-tight">{c.label}</div>
          <div className={`text-2xl font-bold ${c.cls} mt-0.5`}>{c.val}</div>
        </button>
      ))}
    </div>
  );
}
