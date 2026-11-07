import { useRef, useState } from 'react';
import { Modal } from './common/Modal';
import { useStore } from '../state/AppStore';
import { useUi } from './common/UiProvider';
import type { Asset, Risk, Treatment } from '../data/models';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile, type ImportResult } from '../io/import';
import { downloadAssetTemplate, downloadRiskTemplate, downloadTreatmentTemplate } from '../io/templates';
import { outcomeMessage } from '../data/importCommit';

type Tab = 'assets' | 'risks' | 'treatments';

/** S2 §3.6: at most this many records are listed in the preview (totals are always shown). */
export const PREVIEW_ROW_LIMIT = 100;

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
  // S2 stale-preview guard: every selection (and reset / tab switch) starts a new
  // generation. A read that completes for an older generation is ignored, and only
  // a preview produced by the CURRENT generation can be imported.
  const selection = useRef(0);
  const [previewGen, setPreviewGen] = useState<number | null>(null);
  // A REJECTED / UNCERTAIN outcome stays on screen and disables Import until a
  // new file is chosen (S2 §4.5).
  const [outcome, setOutcome] = useState<{ kind: string; message: string } | null>(null);

  const result = tab === 'assets' ? assetResult : tab === 'risks' ? riskResult : treatmentResult;
  const importable =
    !!result && !busy && !committing && !outcome && previewGen === selection.current && result.rows.length > 0 && result.errors.length === 0;

  const clearPreview = () => {
    setAssetResult(null);
    setRiskResult(null);
    setTreatmentResult(null);
    setPreviewGen(null);
    setOutcome(null);
  };

  const reset = () => {
    selection.current += 1; // invalidates any read still in flight
    setFileName('');
    clearPreview();
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    reset();
  };

  const onFile = async (file: File | undefined) => {
    const gen = ++selection.current;
    clearPreview(); // the previous preview is invalid from this moment
    setFileName(file?.name ?? '');
    if (!file) {
      setBusy(false); // selection cleared: nothing to read, nothing importable
      return;
    }
    setBusy(true);
    try {
      if (tab === 'assets') {
        const res = await parseAssetsFile(file, store.assets);
        if (gen !== selection.current) return;
        setAssetResult(res);
      } else if (tab === 'risks') {
        const res = await parseRisksFile(file, store.risks, store.assets);
        if (gen !== selection.current) return;
        setRiskResult(res);
      } else {
        const res = await parseTreatmentsFile(file, store.treatments, store.risks);
        if (gen !== selection.current) return;
        setTreatmentResult(res);
      }
      setPreviewGen(gen);
    } catch (e) {
      if (gen !== selection.current) return;
      ui.toast(`Could not read file: ${(e as Error).message}`, 'bg-red-700');
      reset();
    } finally {
      if (gen === selection.current) setBusy(false);
    }
  };

  const commit = async () => {
    // S2 all-or-nothing: any error anywhere in the file blocks the import; and only
    // the preview of the latest, fully read selection may be imported.
    if (!importable || !result) return;
    const gen = selection.current;
    setCommitting(true);
    try {
      // S2 create-only path: audit pre-flight, raw-storage rechecks (IDs, B-3),
      // one checked append, one checked audit batch; the store refreshes only
      // from storage read-backs.
      const o = await store.importNew(tab, result.rows);
      const message = outcomeMessage(o, tab);
      if (o.kind === 'committed') {
        ui.toast(message, 'bg-green-700');
        onClose();
        return;
      }
      if (o.kind === 'committed-audit-not-recorded' || o.kind === 'committed-audit-uncertain') {
        ui.toast(message, 'bg-orange-600'); // data saved, audit not (provably / possibly) recorded
        onClose();
        return;
      }
      // REJECTED or UNCERTAIN: keep the modal open with the message; Import stays
      // disabled until a new file is chosen. Nothing is retried.
      if (gen === selection.current) setOutcome({ kind: o.kind, message });
    } catch (e) {
      if (gen === selection.current) {
        setOutcome({
          kind: 'uncertain',
          message: `The import failed unexpectedly (${(e as Error).message}). It may or may not have been saved; check the list before importing again.`,
        });
      }
    } finally {
      setCommitting(false);
    }
  };

  // Preview helpers (S2 §3.6): record label and parent links shown per row.
  const assetName = new Map(store.assets.map((a) => [a.id, a.name]));
  const riskThreat = new Map(store.risks.map((r) => [r.id, r.threat]));
  const previewRows: { id: string; label: string; links: string[] }[] = (() => {
    if (tab === 'assets') return (assetResult?.rows ?? []).map((a) => ({ id: a.id, label: a.name, links: [] }));
    if (tab === 'risks') {
      return (riskResult?.rows ?? []).map((r) => ({ id: r.id, label: r.threat, links: r.assetIds.map((id) => `${id} — ${assetName.get(id) ?? ''}`) }));
    }
    return (treatmentResult?.rows ?? []).map((t) => ({ id: t.id, label: t.title, links: t.riskIds.map((id) => `${id} — ${riskThreat.get(id) ?? ''}`) }));
  })();

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
      subtitle="Upload a pre-drafted .csv (download the template below). Import creates new records only; IDs are assigned automatically, so leave the ID column blank."
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
            {/* Validation summary (S2 §3.6, D5-3): the whole file is validated before Import is enabled. */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-700">{result.totalDataRows} rows read</span>
              <span className="px-2.5 py-1 rounded bg-green-100 text-green-800">{result.created} new (valid)</span>
              {result.skipped > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-100 text-red-800">{result.skipped} rows with errors</span>
              )}
              {result.errors.length > 0 && (
                <span className="px-2.5 py-1 rounded bg-red-100 text-red-800">{result.errors.length} errors</span>
              )}
            </div>

            {previewRows.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <p className="px-3 py-2 text-xs text-gray-600 border-b">
                  New records only. IDs are assigned automatically. These IDs are final: if any of them is taken before you import, the import is refused, not renumbered.
                </p>
                <table className="w-full text-xs">
                  <thead className="text-gray-600 font-semibold">
                    <tr className="text-left">
                      <th className="px-3 py-1.5 w-28">ID (assigned)</th>
                      <th className="px-3 py-1.5">Record</th>
                      {tab !== 'assets' && <th className="px-3 py-1.5">Links to</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, PREVIEW_ROW_LIMIT).map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{p.id}</td>
                        <td className="px-3 py-1.5">{p.label}</td>
                        {tab !== 'assets' && <td className="px-3 py-1.5">{p.links.join('; ')}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > PREVIEW_ROW_LIMIT && (
                  <p className="px-3 py-2 text-xs text-gray-500 border-t">…and {previewRows.length - PREVIEW_ROW_LIMIT} more</p>
                )}
              </div>
            )}

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
            {result.errors.length > 0 && (
              <p className="text-xs text-gray-500">Nothing is imported while the file has any error. Fix the problems above and choose the file again.</p>
            )}
          </div>
        )}

        {outcome && (
          <div
            role="alert"
            className={`rounded-lg border p-3 text-sm ${outcome.kind === 'rejected' ? 'border-red-200 bg-red-50 text-red-800' : 'border-orange-200 bg-orange-50 text-orange-800'}`}
          >
            {outcome.message}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={!importable}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {committing ? 'Importing…' : result ? `Import ${result.rows.length} ${tab}` : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
