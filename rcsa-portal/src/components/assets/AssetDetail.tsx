import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { Badge } from '../common/Badge';
import { assetValue, criticality } from '../../domain/scoring';

/** Asset detail panel shown under the catalog when a single asset is selected. */
export function AssetDetail() {
  const store = useStore();
  const modals = useModals();
  const a = store.selectedAssetId ? store.assets.find((x) => x.id === store.selectedAssetId) : null;
  if (!a) return null;

  const v = assetValue(a);
  const [cl, cc] = criticality(v);

  return (
    <div className="asset-detail section-card p-5 mt-4">
      <div className="flex flex-col lg:flex-row lg:justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-800">{a.id} – {a.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{a.process} · {a.department}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => modals.editAsset(a.id)} className="btn-neutral border rounded px-3 py-1.5 text-sm hover:bg-gray-50">Edit Asset</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Applicant</div><div>{a.applicantName}</div></div>
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Data Class</div><div>{a.dataClass}</div></div>
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Next Review</div><div>{a.reviewDate || 'Not set'}</div></div>
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Asset Value</div><div className="font-bold text-lg">{v} <Badge className={`${cc} text-xs`}>{cl}</Badge></div></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {a.pci === 'Yes' && <Badge className="bg-purple-100 text-purple-800">PCI DSS</Badge>}
        {a.criticalProcess === 'Yes' && <Badge className="bg-red-100 text-red-800">Critical Process</Badge>}
        {a.internet === 'Yes' && <Badge className="bg-blue-100 text-blue-800">Internet-facing</Badge>}
        {a.thirdParty === 'Yes' && <Badge className="bg-yellow-100 text-yellow-800">3rd Party Dep.</Badge>}
        {a.cloud === 'Yes' && <Badge className="bg-sky-100 text-sky-800">Cloud-hosted</Badge>}
      </div>
    </div>
  );
}
