import { useMemo } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { Badge } from '../common/Badge';
import { AssetFilters } from './AssetFilters';
import { assetValue, criticality } from '../../domain/scoring';
import { getFilteredAssets } from '../../state/filters';

export function AssetTable() {
  const store = useStore();
  const modals = useModals();

  const filtered = useMemo(
    () =>
      getFilteredAssets({
        assets: store.assets,
        risks: store.risks,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }),
    [store.assets, store.risks, store.selectedAssetId, store.globalFilter, store.assetFilters, store.riskFilters],
  );

  const riskCount = useMemo(() => {
    const counts = new Map<string, number>();
    store.risks.forEach((r) => counts.set(r.assetId, (counts.get(r.assetId) || 0) + 1));
    return counts;
  }, [store.risks]);

  return (
    <div className="section-card">
      <div className="px-5 py-4 border-b bg-gray-50">
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-gray-800">1. Asset Catalog</h2>
          <AssetFilters />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left">Asset #</th>
              <th className="px-4 py-3 text-left">Name / Process</th>
              <th className="px-4 py-3 text-left">Owners</th>
              <th className="px-4 py-3 text-center">C – I – A</th>
              <th className="px-4 py-3 text-center">Value</th>
              <th className="px-4 py-3 text-left">Tags</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">No assets match current filters.</td>
              </tr>
            ) : (
              filtered.map((a) => {
                const v = assetValue(a);
                const [cl, cc] = criticality(v);
                const rc = riskCount.get(a.id) || 0;
                const selected = store.selectedAssetId === a.id;
                return (
                  <tr
                    key={a.id}
                    className={`asset-row ${selected ? 'active-row' : ''}`}
                    onClick={() => modals.openSummary(a.id)}
                  >
                    <td className="px-4 py-3 font-mono text-blue-600 font-semibold text-xs">{a.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-800">{a.name}</div>
                      <div className="text-xs text-gray-500">{a.process} · {a.department}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{a.busOwner}</div>
                      <div className="text-xs text-gray-500">{a.itOwner}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-gray-700">{a.c}–{a.i}–{a.a}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-base">{v}</span>
                      <br />
                      <Badge className={`${cc} text-[.65rem]`}>{cl}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge className="bg-gray-100 text-gray-700">{a.dataClass}</Badge>
                        <Badge className="bg-gray-100 text-gray-500">{rc} risk{rc !== 1 ? 's' : ''}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={a.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>{a.status}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button onClick={() => modals.editAsset(a.id)} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => modals.deleteAssetFlow(a.id)} className="text-red-500 text-xs hover:underline">Delete</button>
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
