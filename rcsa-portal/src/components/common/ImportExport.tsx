import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { useUi } from './UiProvider';
import { exportRows, importCsvText, type ImportResult, type IoSpec } from '../../lib/tableIo';
import { outcomeMessage, type ImportOutcome, type ReadForImport } from '../../data/importCommit';

// Shared Import/Export CSV buttons + import preview modal for the standalone
// modules. Excel users: open your sheet → "Save As → CSV UTF-8" → upload here.
//
// ID integrity S2: import is CREATE-ONLY. The preview lists the new records with
// their assigned IDs; any error blocks the whole file; the commit goes through
// the module repository's checked `importNew` (never bulkSave) and the page is
// refreshed only from what storage read back. All five outcomes are reported.

/** S2 §3.6: at most this many records are listed in the preview (totals are always shown). */
const PREVIEW_ROW_LIMIT = 100;

interface ImportRepo<T> {
  importNew(rows: T[]): ImportOutcome;
  readForImport(): ReadForImport;
}

interface Props<T extends { id: string }> {
  spec: IoSpec<T>;
  /** Rows the Export button writes (usually the filtered view). */
  exportSource: T[];
  /** Full current dataset — new IDs are allocated after it. */
  existing: T[];
  canImport: boolean;
  canExport: boolean;
  /** The module repository (createLocalRepo): its checked, create-only `importNew` commits the file. */
  repo: ImportRepo<T>;
  /** Receives the records storage read back after a commit (verified, or the read-only re-read). */
  onRefreshed: (records: T[]) => void;
}

const btn = 'btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium';

export function ImportExport<T extends { id: string }>({ spec, exportSource, existing, canImport, canExport, repo, onRefreshed }: Props<T>) {
  const ui = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  // S2 stale-preview guard: each selection starts a new generation; the preview is
  // tagged with the generation that produced it, and a read completing for an older
  // generation is ignored. Only the latest, fully read selection can be imported.
  const selection = useRef(0);
  const [preview, setPreview] = useState<{ gen: number; res: ImportResult<T> } | null>(null);
  // A REJECTED / UNCERTAIN outcome stays in the modal and disables Import until a new file is chosen.
  const [outcome, setOutcome] = useState<{ gen: number; kind: string; message: string } | null>(null);

  const closePreview = () => {
    selection.current += 1; // also invalidates any read still in flight
    setPreview(null);
    setOutcome(null);
  };

  const onFile = async (f: File | undefined) => {
    const gen = ++selection.current;
    setPreview(null); // the previous preview is invalid from this moment
    setOutcome(null);
    if (!f) return; // selection cleared: nothing to read, nothing importable
    try {
      const text = await f.text();
      if (gen !== selection.current) return;
      const res = importCsvText(spec, text, existing);
      // File errors (strict CSV grammar) come with zero data rows: show them, don't hide them.
      if (res.totalDataRows === 0 && res.errors.length === 0) { ui.toast('No data rows found in that file.', 'bg-orange-600'); return; }
      setPreview({ gen, res });
    } catch {
      if (gen !== selection.current) return;
      ui.toast('Could not read that file.', 'bg-orange-600');
    }
  };

  const current = preview && preview.gen === selection.current ? preview.res : null;
  const shownOutcome = outcome && outcome.gen === selection.current ? outcome : null;
  const importable = !!current && !shownOutcome && current.rows.length > 0 && current.errors.length === 0;

  const confirm = () => {
    // S2 all-or-nothing: any error anywhere in the file blocks the import; and only
    // the preview of the latest selection may be imported.
    if (!importable || !current) return;
    const gen = selection.current;
    const o = repo.importNew(current.rows);
    const message = outcomeMessage(o, `${spec.entity.toLowerCase()}s`);
    // Refresh the page ONLY from storage read-backs; a rejected or unreadable
    // outcome leaves the page as it was.
    const records =
      o.kind === 'rejected' ? null
        : o.kind === 'uncertain' ? (o.refresh.status === 'ok' ? o.refresh.records : null)
          : o.records;
    if (records) onRefreshed(records as T[]);
    if (o.kind === 'committed') {
      ui.toast(message, 'bg-green-700');
      closePreview();
    } else if (o.kind === 'committed-audit-not-recorded' || o.kind === 'committed-audit-uncertain') {
      ui.toast(message, 'bg-orange-600'); // data saved; audit not (provably / possibly) recorded
      closePreview();
    } else {
      setOutcome({ gen, kind: o.kind, message }); // REJECTED / UNCERTAIN: stays visible, no retry
    }
  };

  // Record label for the preview: the spec's first non-ID column (§3.6).
  const labelCol = spec.cols.find((c) => c.header.trim().toLowerCase() !== 'id');

  return (
    <>
      {canImport && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <button onClick={() => fileRef.current?.click()} className={btn}>Import CSV</button>
        </>
      )}
      {canExport && <button onClick={() => exportRows(spec, exportSource)} className={btn}>Export CSV</button>}

      {current && (
        <Modal open onClose={closePreview} title={`Import ${spec.entity}s`} subtitle="Review before anything is saved" maxWidth="max-w-lg">
          <div className="p-6 space-y-4">
            {/* Validation summary (S2 §3.6, D5-3): the whole file is validated before Import is enabled. */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { l: 'Rows read', v: current.totalDataRows, t: 'mut' },
                { l: 'New (valid)', v: current.created, t: 'low' },
                { l: 'Rows with errors', v: current.skipped, t: current.skipped ? 'crit' : 'mut' },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xl font-bold tabular-nums" style={{ color: `var(--${s.t})` }}>{s.v}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {current.rows.length > 0 && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-2 text-[11px]" style={{ color: 'var(--text3)' }}>
                  New records only. IDs are assigned automatically. These IDs are final: if any of them is taken before you import, the import is refused, not renumbered.
                </div>
                <ul className="max-h-40 overflow-y-auto divide-y text-[12px]" style={{ borderColor: 'var(--border)' }}>
                  {current.rows.slice(0, PREVIEW_ROW_LIMIT).map((r) => (
                    <li key={r.id} className="px-3 py-1.5" style={{ color: 'var(--text2)' }}>
                      <span className="font-mono">{r.id}</span>{labelCol ? <> · {String(labelCol.value(r))}</> : null}
                    </li>
                  ))}
                  {current.rows.length > PREVIEW_ROW_LIMIT && (
                    <li className="px-3 py-1.5" style={{ color: 'var(--text3)' }}>…and {current.rows.length - PREVIEW_ROW_LIMIT} more</li>
                  )}
                </ul>
              </div>
            )}

            {current.errors.length > 0 && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>
                  {current.errors.length} validation error{current.errors.length === 1 ? '' : 's'} — nothing is imported until they are fixed
                </div>
                <ul className="max-h-40 overflow-y-auto divide-y text-[12px]" style={{ borderColor: 'var(--border)' }}>
                  {current.errors.slice(0, 12).map((e, i) => (
                    <li key={i} className="px-3 py-1.5" style={{ color: 'var(--text2)' }}>
                      Row {e.row} · <b>{e.field}</b>: {e.message}
                    </li>
                  ))}
                  {current.errors.length > 12 && <li className="px-3 py-1.5" style={{ color: 'var(--text3)' }}>…and {current.errors.length - 12} more</li>}
                </ul>
              </div>
            )}

            {shownOutcome && (
              <div role="alert" className="rounded-lg border p-3 text-[13px]" style={{ borderColor: 'var(--border)', color: shownOutcome.kind === 'rejected' ? 'var(--crit)' : 'var(--text2)' }}>
                {shownOutcome.message}
              </div>
            )}

            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
              Import creates new records only; IDs are assigned automatically, so leave the ID column blank. Edit existing records in their forms.
              Working from Excel? Use <b>Save As → CSV UTF-8</b> first.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={closePreview} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
              <button
                onClick={confirm}
                disabled={!importable}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                Import {current.rows.length} row{current.rows.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
