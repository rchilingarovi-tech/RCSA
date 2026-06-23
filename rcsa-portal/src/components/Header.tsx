import { useStore } from '../state/AppStore';
import { useModals } from '../state/ModalsProvider';
import { useUi } from './common/UiProvider';
import { exportAssetsCsv, exportRisksCsv } from '../csv/export';

export function Header() {
  const store = useStore();
  const modals = useModals();
  const ui = useUi();

  return (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">RCSA Portal</h1>
        <p className="text-xs text-gray-500">
          Asset catalogue · Risk register · Treatment workflow · Controls · Approvals · Reporting
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => modals.newAsset()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700">+ New Asset</button>
        <button onClick={() => exportAssetsCsv(store.assets)} className="btn-neutral bg-white border px-3 py-2 rounded text-sm hover:bg-gray-50">Export Assets CSV</button>
        <button onClick={() => exportRisksCsv(store.risks, store.assets)} className="btn-neutral bg-white border px-3 py-2 rounded text-sm hover:bg-gray-50">Export Risks CSV</button>
        <button
          onClick={() => ui.confirm('Reset demo data?', 'This restores the original sample assets and risks and discards your changes.', () => {
            void store.resetDemoData();
            store.clearGlobalFilter();
            store.clearSelection();
            ui.toast('Demo data restored', 'bg-green-700');
          })}
          className="btn-neutral bg-white border px-3 py-2 rounded text-sm hover:bg-gray-50"
        >
          Reset demo data
        </button>
      </div>
    </div>
  );
}
