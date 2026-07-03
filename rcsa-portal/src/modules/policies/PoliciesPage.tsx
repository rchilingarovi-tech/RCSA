import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { policyRepo } from './repo';
import {
  DOC_STATUSES,
  DOC_TYPES,
  daysToReview,
  reviewDue,
  statusColor,
  type DocStatus,
  type DocType,
  type PolicyDoc,
} from './types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';
const ctl = 'border rounded px-2 py-1.5 text-sm bg-white';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function DocModal({ doc, onClose, onSave }: { doc: PolicyDoc | 'new'; onClose: () => void; onSave: (d: PolicyDoc) => void }) {
  const ui = useUi();
  const e = doc === 'new' ? null : doc;
  const [title, setTitle] = useState(e?.title ?? '');
  const [type, setType] = useState<DocType>(e?.type ?? 'Policy');
  const [version, setVersion] = useState(e?.version ?? '1.0');
  const [status, setStatus] = useState<DocStatus>(e?.status ?? 'Draft');
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [effective, setEffective] = useState(e?.effective ?? '');
  const [nextReview, setNextReview] = useState(e?.nextReview ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a document title.', 'bg-orange-600'); return; }
    onSave({
      id: e ? e.id : policyRepo.nextId(),
      title: title.trim(),
      type,
      version: version.trim() || '1.0',
      status,
      owner: owner.trim(),
      effective,
      nextReview,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Document — ${e.id}` : 'New Document'} subtitle="Governance document" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="Document title" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Type</label>
            <select value={type} onChange={(ev) => setType(ev.target.value as DocType)} className={field}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div><label className={lbl}>Version</label><input value={version} onChange={(ev) => setVersion(ev.target.value)} className={field} placeholder="1.0" /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as DocStatus)} className={field}>{DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div><label className={lbl}>Owner</label><input value={owner} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Name / team" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Effective date</label><input type="date" value={effective} onChange={(ev) => setEffective(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Next review</label><input type="date" value={nextReview} onChange={(ev) => setNextReview(ev.target.value)} className={field} /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Document</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function PoliciesPage() {
  const ui = useUi();
  const perms = usePermissions('policies');
  const [docs, setDocs] = useState<PolicyDoc[]>(() => policyRepo.list());
  const [editing, setEditing] = useState<PolicyDoc | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);

  const chips = useMemo(() => [
    { label: 'Documents', value: docs.length, color: 'var(--text)' },
    { label: 'Approved', value: docs.filter((d) => d.status === 'Approved').length, color: 'var(--low)' },
    { label: 'Under Review', value: docs.filter((d) => d.status === 'Under Review').length, color: 'var(--med)' },
    { label: 'Review due', value: docs.filter(reviewDue).length, color: 'var(--high)' },
  ], [docs]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter((d) => {
      if (dueOnly && !reviewDue(d)) return false;
      if (q && !`${d.id} ${d.title} ${d.type} ${d.owner}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, search, dueOnly]);

  const save = (d: PolicyDoc) => { setDocs(policyRepo.save(d)); setEditing(null); ui.toast('Document saved', 'bg-green-700'); };
  const del = (d: PolicyDoc) => ui.confirm(`Delete "${d.title}"?`, 'This cannot be undone.', () => { setDocs(policyRepo.remove(d.id)); ui.toast('Document deleted', 'bg-red-700'); });

  const reviewCell = (d: PolicyDoc) => {
    if (!d.nextReview) return <span className="text-gray-400">—</span>;
    const dl = daysToReview(d.nextReview);
    const retired = d.status === 'Retired';
    const color = retired ? 'var(--text3)' : dl !== null && dl < 0 ? 'var(--crit)' : dl !== null && dl <= 60 ? 'var(--high)' : 'var(--text2)';
    const note = retired ? '' : dl !== null && dl < 0 ? ' · overdue' : dl !== null && dl <= 60 ? ` · ${dl}d` : '';
    return <span className="font-mono text-xs whitespace-nowrap" style={{ color }}>{d.nextReview}{note}</span>;
  };

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Document</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample documents and discards your changes.', () => { setDocs(policyRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          {chips.map((c) => (
            <div key={c.label} className="section-card px-4 py-3 flex-1 min-w-[150px]">
              <div className="text-[11px] mb-1" style={{ color: 'var(--text3)' }}>{c.label}</div>
              <div className="text-xl font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800">Document Library</h2>
              <span className="text-xs text-gray-500">{rows.length} of {docs.length}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${ctl} w-56`} placeholder="Search title, owner, type…" />
              <button
                onClick={() => setDueOnly((v) => !v)}
                className="btn-neutral border rounded px-3 py-1.5 text-xs"
                style={dueOnly ? { borderColor: 'var(--accent)', color: 'var(--accent-d)', background: 'var(--accent-soft)' } : undefined}
              >
                {dueOnly ? '✓ Review due' : 'Review due'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Doc ID</th>
                  <th className={th}>Title</th>
                  <th className={th}>Type</th>
                  <th className={`${th} text-center`}>Version</th>
                  <th className={th}>Status</th>
                  <th className={th}>Owner</th>
                  <th className={th}>Effective</th>
                  <th className={th}>Next Review</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No documents match.</td></tr>
                ) : (
                  rows.map((d) => (
                    <tr key={d.id} className="risk-row">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{d.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{d.title}</td>
                      <td className="px-4 py-3 text-gray-500">{d.type}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-gray-500">{d.version}</td>
                      <td className="px-4 py-3"><Pill text={d.status} k={statusColor(d.status)} /></td>
                      <td className="px-4 py-3 text-sm">{d.owner || 'Unassigned'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{d.effective || '—'}</td>
                      <td className="px-4 py-3">{reviewCell(d)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs">
                          {perms.edit && <button onClick={() => setEditing(d)} className="text-blue-600 hover:underline">Edit</button>}
                          {perms.remove && <button onClick={() => del(d)} className="text-red-500 hover:underline">Delete</button>}
                          {!perms.edit && !perms.remove && <span style={{ color: 'var(--text3)' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && <DocModal doc={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
