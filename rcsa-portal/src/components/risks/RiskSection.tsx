import { useMemo } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { Badge } from '../common/Badge';
import { RiskFilters } from './RiskFilters';
import {
  inherentScore, residualScore, riskLevel, effectiveStatus, statusBadgeClass,
} from '../../domain/scoring';
import { getFilteredRisks } from '../../state/filters';

export function RiskSection() {
  const store = useStore();
  const modals = useModals();

  const selectedAsset = store.selectedAssetId
    ? store.assets.find((a) => a.id === store.selectedAssetId)
    : null;

  const heading = selectedAsset
    ? `${selectedAsset.id} – ${selectedAsset.name}`
    : store.globalFilter
      ? `Global Filter: ${store.globalFilter.label}`
      : '';

  const filtered = useMemo(
    () =>
      getFilteredRisks({
        assets: store.assets,
        risks: store.risks,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }),
    [store.assets, store.risks, store.selectedAssetId, store.globalFilter, store.riskFilters],
  );

  return (
    <div className="section-card mt-4">
      <div className="px-5 py-4 border-b bg-gray-50 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">2. Risk Register</h2>
          <p className="text-xs text-gray-500 mt-0.5"><span className="selected-asset-name font-bold text-blue-600">{heading}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RiskFilters />
          <button onClick={() => modals.openHeatmap()} className="btn-neutral bg-white border px-3 py-1.5 text-sm rounded hover:bg-gray-50">Grid View</button>
          <button onClick={() => modals.openRiskForSelected()} className="bg-red-600 text-white px-3 py-1.5 text-sm rounded shadow hover:bg-red-700 font-semibold">+ Log Risk</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Risk #</th>
              <th className="px-4 py-3 text-left">Asset</th>
              <th className="px-4 py-3 text-left">Threat</th>
              <th className="px-4 py-3 text-left">Vulnerability</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-center">Inherent</th>
              <th className="px-4 py-3 text-center">Residual</th>
              <th className="px-4 py-3 text-left">Treatment</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">No risks match criteria.</td></tr>
            ) : (
              filtered.map((r) => {
                const inScore = inherentScore(r);
                const resScore = residualScore(r);
                const inL = riskLevel(inScore);
                const resL = riskLevel(resScore);
                const status = effectiveStatus(r);
                return (
                  <tr key={r.id} className="risk-row">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold">{r.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 font-semibold hover:underline cursor-pointer" onClick={() => modals.openSummary(r.assetId)}>{r.assetId}</td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px]">{r.threat}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">{r.vuln}</td>
                    <td className="px-4 py-3 text-sm">{r.owner}</td>
                    <td className="px-4 py-3 text-center"><Badge className={inL[1]}>{inScore}<br /><span className="font-normal">{inL[0]}</span></Badge></td>
                    <td className="px-4 py-3 text-center"><Badge className={resL[1]}>{resScore}<br /><span className="font-normal">{resL[0]}</span></Badge></td>
                    <td className="px-4 py-3"><div className="font-semibold text-sm">{r.assessment}</div><div className="text-xs text-gray-400">Due: {r.deadline || 'N/A'}</div></td>
                    <td className="px-4 py-3"><Badge className={statusBadgeClass(status)}>{status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 text-xs">
                        <button onClick={() => modals.editRisk(r.id)} className="text-blue-600 hover:underline">Edit</button>
                        <button onClick={() => modals.deleteRiskFlow(r.id)} className="text-red-500 hover:underline">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
