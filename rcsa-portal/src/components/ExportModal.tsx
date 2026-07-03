import { useState } from 'react';
import { Modal } from './common/Modal';
import { useStore } from '../state/AppStore';
import { useUi } from './common/UiProvider';
import { exportAssetsCsv, exportRisksCsv, exportTreatmentsCsv } from '../csv/export';

type Tab = 'assets' | 'risks' | 'treatments';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const ui = useUi();
  const [tab, setTab] = useState<Tab>('assets');

  const count = tab === 'assets' ? store.assets.length : tab === 'risks' ? store.risks.length : store.treatments.length;

  const onExport = () => {
    if (tab === 'assets') exportAssetsCsv(store.assets);
    else if (tab === 'risks') exportRisksCsv(store.risks, store.assets, store.treatments);
    else exportTreatmentsCsv(store.treatments);
    ui.toast(`Exported ${count} ${tab} to CSV`, 'bg-green-700');
    onClose();
  };

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
        tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Export to spreadsheet"
      subtitle="Download the current data as a CSV file (opens in Excel)."
      maxWidth="max-w-2xl"
      headerExtra={
        <div className="px-6 pt-3 border-b flex gap-2">
          {tabBtn('assets', 'Assets')}
          {tabBtn('risks', 'Risks')}
          {tabBtn('treatments', 'Treatments')}
        </div>
      }
    >
      <div className="p-6 space-y-5">
        <p className="text-sm text-gray-600">
          {tab === 'assets'
            ? 'Exports every asset with its value, criticality, owners, classification, scope flags and status.'
            : tab === 'risks'
              ? 'Exports every risk with its scores, levels, decision, rolled-up treatment status, linked treatments and controls.'
              : 'Exports every treatment with the risks it addresses, owner, due date, status and evidence.'}
        </p>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-2xl font-bold text-gray-800">{count}</span>
          <span className="text-gray-500">{tab} ready to export</span>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={count === 0}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↓ Export {tab} CSV
          </button>
        </div>
      </div>
    </Modal>
  );
}
