import { useRef, useState } from 'react';
import { Modal } from './Modal';
import { useUi } from './UiProvider';
import { exportRows, importCsvText, type ImportResult, type IoSpec } from '../../lib/tableIo';

// Shared Import/Export CSV buttons + import preview modal for the standalone
// modules. Excel users: open your sheet → "Save As → CSV UTF-8" → upload here.
// Import previews counts + row-level validation errors before anything lands.

interface Props<T extends { id: string }> {
  spec: IoSpec<T>;
  /** Rows the Export button writes (usually the filtered view). */
  exportSource: T[];
  /** Full current dataset — import matches IDs against it. */
  existing: T[];
  canImport: boolean;
  canExport: boolean;
  /** Commit the validated batch (page calls repo.bulkSave + setState). */
  onImported: (items: T[]) => void;
}

const btn = 'btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium';

export function ImportExport<T extends { id: string }>({ spec, exportSource, existing, canImport, canExport, onImported }: Props<T>) {
  const ui = useUi();
  const fileRef = useRef<HTMLInputElement>(null);
  // S2 stale-preview guard: each selection starts a new generation; the preview is
  // tagged with the generation that produced it, and a read completing for an older
  // generation is ignored. Only the latest, fully read selection can be imported.
  const selection = useRef(0);
  const [preview, setPreview] = useState<{ gen: number; res: ImportResult<T> } | null>(null);

  const closePreview = () => {
    selection.current += 1; // also invalidates any read still in flight
    setPreview(null);
  };

  const onFile = async (f: File | undefined) => {
    const gen = ++selection.current;
    setPreview(null); // the previous preview is invalid from this moment
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
  const importable = !!current && current.rows.length > 0 && current.errors.length === 0;

  const confirm = () => {
    // S2 all-or-nothing: any error anywhere in the file blocks the import; and only
    // the preview of the latest selection may be imported.
    if (!importable || !current) return;
    const preview = current;
    onImported(preview.rows);
    ui.toast(`Imported ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'} (${preview.created} new, ${preview.updated} updated)`, 'bg-green-700');
    closePreview();
  };

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
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { l: 'New', v: current.created, t: 'low' },
                { l: 'Updated', v: current.updated, t: 'info' },
                { l: 'Skipped (errors)', v: current.skipped, t: current.skipped ? 'crit' : 'mut' },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xl font-bold tabular-nums" style={{ color: `var(--${s.t})` }}>{s.v}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
                </div>
              ))}
            </div>

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
