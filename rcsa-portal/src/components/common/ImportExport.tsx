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
  const [preview, setPreview] = useState<ImportResult<T> | null>(null);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const res = importCsvText(spec, text, existing);
      if (res.totalDataRows === 0) { ui.toast('No data rows found in that file.', 'bg-orange-600'); return; }
      setPreview(res);
    } catch {
      ui.toast('Could not read that file.', 'bg-orange-600');
    }
  };

  const confirm = () => {
    if (!preview || preview.rows.length === 0) return;
    onImported(preview.rows);
    ui.toast(`Imported ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'} (${preview.created} new, ${preview.updated} updated)`, 'bg-green-700');
    setPreview(null);
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

      {preview && (
        <Modal open onClose={() => setPreview(null)} title={`Import ${spec.entity}s`} subtitle="Review before anything is saved" maxWidth="max-w-lg">
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { l: 'New', v: preview.created, t: 'low' },
                { l: 'Updated', v: preview.updated, t: 'info' },
                { l: 'Skipped (errors)', v: preview.skipped, t: preview.skipped ? 'crit' : 'mut' },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="text-xl font-bold tabular-nums" style={{ color: `var(--${s.t})` }}>{s.v}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{s.l}</div>
                </div>
              ))}
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>
                  {preview.errors.length} validation error{preview.errors.length === 1 ? '' : 's'} — those rows will be skipped
                </div>
                <ul className="max-h-40 overflow-y-auto divide-y text-[12px]" style={{ borderColor: 'var(--border)' }}>
                  {preview.errors.slice(0, 12).map((e, i) => (
                    <li key={i} className="px-3 py-1.5" style={{ color: 'var(--text2)' }}>
                      Row {e.row} · <b>{e.field}</b>: {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 12 && <li className="px-3 py-1.5" style={{ color: 'var(--text3)' }}>…and {preview.errors.length - 12} more</li>}
                </ul>
              </div>
            )}

            <p className="text-[12px]" style={{ color: 'var(--text3)' }}>
              Rows with a matching ID update the existing record (blank cells keep current values); rows without an ID are created.
              Working from Excel? Use <b>Save As → CSV UTF-8</b> first.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setPreview(null)} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
              <button
                onClick={confirm}
                disabled={preview.rows.length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-50"
              >
                Import {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
