import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { PageHeader } from './PageHeader';
import { AssetFilters } from '../../components/assets/AssetFilters';
import { AssetTable } from '../../components/assets/AssetTable';

// Asset Catalogue — own filter + table. Clicking a row opens the asset summary
// popup (the old inline detail panel is gone; the popup already shows it all).
export function AssetCataloguePage() {
  const modals = useModals();
  const perms = usePermissions('asset-catalogue');

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => modals.newAsset()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Asset</button>}
      </PageHeader>

      <div className="p-6 space-y-4">
        <AssetFilters />
        <AssetTable />
      </div>
    </>
  );
}
