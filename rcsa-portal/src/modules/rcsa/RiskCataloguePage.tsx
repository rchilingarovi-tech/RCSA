import { useMemo } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { PageHeader } from './PageHeader';
import { RiskFilters } from '../../components/risks/RiskFilters';
import { RiskTable } from '../../components/risks/RiskTable';
import { getCatalogueRisks } from '../../state/filters';

// Risk Catalogue — every risk, with its own risk-specific filters and add.
// Independent of the Dashboard: its chart facet is dropped on navigation.
export function RiskCataloguePage() {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('risk-catalogue');

  const filtered = useMemo(
    () =>
      getCatalogueRisks({
        assets: store.assets,
        risks: store.risks,
        treatments: store.treatments,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }),
    [store.assets, store.risks, store.treatments, store.globalFilter, store.riskFilters],
  );

  return (
    <>
      <PageHeader>
        <button onClick={() => modals.openHeatmap()} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Grid View</button>
        {perms.create && <button onClick={() => modals.openNewRisk()} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Risk</button>}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-gray-800">Risk Register</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RiskFilters />
              <span className="text-xs text-gray-500">{filtered.length} risk{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <RiskTable risks={filtered} />
        </div>
      </div>
    </>
  );
}
