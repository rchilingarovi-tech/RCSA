import { useRef, useState } from 'react';
import { Modal } from './common/Modal';
import { useStore } from '../state/AppStore';
import { useUi } from './common/UiProvider';
import type { Asset, Risk, Treatment } from '../data/models';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile, type ImportResult } from '../io/import';
import { downloadAssetTemplate, downloadRiskTemplate, downloadTreatmentTemplate } from '../io/templates';

type Tab = 'assets' | 'risks' | 'treatments';

export function ImportModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const ui = useUi();
  const [tab, setTab] = useState<Tab>('assets');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [assetResult, setAssetResult] = useState<ImportResult<Asset> | null>(null);
  const [riskResult, setRiskResult] = useState<ImportResult<Risk> | null>(null);
  const [treatmentResult, setTreatmentResult] = useState<ImportResult<Treatment> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = tab === 'assets' ? assetResult : tab === 'risks' ? riskResult : treatmentResult;

  const reset = () => {
    setFileName('');
    setAssetResult(null);
    setRiskResult(null);
    setTreatmentResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    reset();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      if (tab === 'assets') {
        setAssetResult(await parseAssetsFile(file, store.assets));
      } else if (tab === 'risks') {
        setRiskResult(await parseRisksFile(file, store.risks, store.assets));
      } else {
        setTreatmentResult(await parseTreatmentsFile(file, store.treatments, store.risks));
      }
    } catch (e) {
      ui.toast(`Could not read file: ${(e as Error).message}`, 'bg-red-700');
      reset();
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!result || result.rows.length === 0) return;
    setCommitting(true);
    try {
      if (tab === 'assets') await store.importAssets(assetResult!.rows);
      else if (tab === 'risks') await store.importRisks(riskResult!.rows);
      else await store.importTreatments(treatmentResult!.rows);
      ui.toast(
        `Imported ${result.rows.length} ${tab} (${result.created} new, ${result.updated} updated)`,
        'bg-green-700',
      );
      onClose();
    } catch (e) {
      ui.toast(`Import failed: ${(e as Error).message}`, 'bg-red-700');
    } finally {
      setCommitting(false);
    }
  };

  const downloadTemplate = () =>
    tab === 'assets' ? downloadAssetTemplate() : tab === 'risks' ? downloadRiskTemplate() : downloadTreatmentTemplate();

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => switchTab(t)}
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
      title="Import from CSV"
      subtitle="Upload a pre-drafted .csv (download the template below). Existing IDs are updated; blank IDs are added."
      maxWidth="max-w-3xl"
      headerExtra={
        <div className="px-6 pt-3 border-b flex gap-2">
          {tabBtn('assets', 'Assets')}
          {tabBtn('risks', 'Risks')}
          {tabBtn('treatments', 'Treatments')}
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-600">
            {tab === 'assets'
              ? 'Each row is one asset. Value & criticality are computed for you.'
              : tab === 'risks'
                ? 'Each row is one risk and must reference at least one existing Asset ID.'
                : 'Each row is one treatment and must reference at least one existing Risk ID.'}
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm hover:bg-gray-50 whitespace-nowrap"
          >
            ↓ Download template
          </button>
        </div>

        <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50">
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <span className="text-sm text-gray-600">
            {fileName ? (
              <><span className="font-semibold">{fileName}</span> — click to choose another</>
            ) : (
              <>Click to choose a file <span className="text-gray-400">(.csv)</span></>
            )}
          </span>
        </label>

        {busy && <p className="text-sm text-gray-500">Reading file…</p>}

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-700">{result.totalDataRows} rows read</span>
              <span className="px-2.5 py-1 rounded bg-green-100 text-green-800">{result.created} new</span>
              <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800">{result.updated} to update</span>
              {result.skipped > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-100 text-red-800">{result.skipped} skipped</span>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-red-800 font-semibold">
                    <tr className="text-left">
                      <th className="px-3 py-1.5 w-16">Row</th>
                      <th className="px-3 py-1.5 w-32">Field</th>
                      <th className="px-3 py-1.5">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="text-red-700">
                    {result.errors.map((e, idx) => (
                      <tr key={idx} className="border-t border-red-100">
                        <td className="px-3 py-1.5">{e.row}</td>
                        <td className="px-3 py-1.5">{e.field}</td>
                        <td className="px-3 py-1.5">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.rows.length === 0 && result.errors.length === 0 && (
              <p className="text-sm text-gray-500">No data rows found in the file.</p>
            )}
            {result.skipped > 0 && result.rows.length > 0 && (
              <p className="text-xs text-gray-500">Rows with problems are skipped; the valid rows can still be imported.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={!result || result.rows.length === 0 || committing}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {committing ? 'Importing…' : result ? `Import ${result.rows.length} ${tab}` : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
