import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { accessRepo } from './repo';
import {
  REVIEW_STATUSES,
  SCOPES,
  overdue,
  statusColor,
  type AccessReview,
  type ReviewStatus,
  type Scope,
} from './types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function ReviewModal({ review, onClose, onSave }: { review: AccessReview | 'new'; onClose: () => void; onSave: (r: AccessReview) => void }) {
  const ui = useUi();
  const e = review === 'new' ? null : review;
  const [name, setName] = useState(e?.name ?? '');
  const [scope, setScope] = useState<Scope>(e?.scope ?? 'System');
  const [period, setPeriod] = useState(e?.period ?? '');
  const [reviewer, setReviewer] = useState(e?.reviewer ?? '');
  const [due, setDue] = useState(e?.due ?? '');
  const [status, setStatus] = useState<ReviewStatus>(e?.status ?? 'Not Started');
  const [progress, setProgress] = useState(String(e?.progress ?? 0));

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a campaign name.', 'bg-orange-600'); return; }
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    onSave({
      id: e ? e.id : accessRepo.nextId(),
      name: name.trim(),
      scope,
      period: period.trim(),
      reviewer: reviewer.trim(),
      due,
      status,
      progress: status === 'Completed' ? 100 : p,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Campaign — ${e.id}` : 'New Campaign'} subtitle="Access review campaign" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Name *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. AWS IAM Review" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Scope</label>
            <select value={scope} onChange={(ev) => setScope(ev.target.value as Scope)} className={field}>{SCOPES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div><label className={lbl}>Period</label><input value={period} onChange={(ev) => setPeriod(ev.target.value)} className={field} placeholder="2026 Q2" /></div>
          <div><label className={lbl}>Reviewer</label><input value={reviewer} onChange={(ev) => setReviewer(ev.target.value)} className={field} placeholder="Name / team" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Due date</label><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} className={field} /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as ReviewStatus)} className={field}>{REVIEW_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div><label className={lbl}>Progress (%)</label><input value={progress} onChange={(ev) => setProgress(ev.target.value)} className={field} inputMode="numeric" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Campaign</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function AccessPage() {
  const ui = useUi();
  const perms = usePermissions('access-reviews');
  const [reviews, setReviews] = useState<AccessReview[]>(() => accessRepo.list());
  const [editing, setEditing] = useState<AccessReview | 'new' | null>(null);

  const chips = useMemo(() => [
    { label: 'Campaigns', value: reviews.length, color: 'var(--text)' },
    { label: 'In Progress', value: reviews.filter((r) => r.status === 'In Progress').length, color: 'var(--info)' },
    { label: 'Completed', value: reviews.filter((r) => r.status === 'Completed').length, color: 'var(--low)' },
    { label: 'Overdue', value: reviews.filter(overdue).length, color: 'var(--crit)' },
  ], [reviews]);

  const save = (r: AccessReview) => { setReviews(accessRepo.save(r)); setEditing(null); ui.toast('Campaign saved', 'bg-green-700'); };
  const del = (r: AccessReview) => ui.confirm(`Delete "${r.name}"?`, 'This cannot be undone.', () => { setReviews(accessRepo.remove(r.id)); ui.toast('Campaign deleted', 'bg-red-700'); });

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Campaign</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample campaigns and discards your changes.', () => { setReviews(accessRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
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
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">Access Review Campaigns</h2>
            <span className="text-xs text-gray-500">{reviews.length} campaigns</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Campaign</th>
                  <th className={th}>Name</th>
                  <th className={th}>Scope</th>
                  <th className={th}>Period</th>
                  <th className={th}>Reviewer</th>
                  <th className={th}>Due</th>
                  <th className={th}>Status</th>
                  <th className={th}>Progress</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No campaigns yet — add one to get started.</td></tr>
                ) : (
                  reviews.map((r) => {
                    const od = overdue(r);
                    return (
                      <tr key={r.id} className="risk-row">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{r.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                        <td className="px-4 py-3"><Pill text={r.scope} k="info" /></td>
                        <td className="px-4 py-3 text-gray-500">{r.period}</td>
                        <td className="px-4 py-3 text-sm">{r.reviewer || 'Unassigned'}</td>
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: od ? 'var(--crit)' : 'var(--text2)' }}>{r.due || '—'}{od ? ' · overdue' : ''}</td>
                        <td className="px-4 py-3"><Pill text={r.status} k={statusColor(r.status)} /></td>
                        <td className="px-4 py-3"><ProgressBar pct={r.progress} color={r.progress === 100 ? 'var(--low)' : od ? 'var(--crit)' : 'var(--accent)'} /></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 text-xs">
                            {perms.edit && <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline">Edit</button>}
                            {perms.remove && <button onClick={() => del(r)} className="text-red-500 hover:underline">Delete</button>}
                            {!perms.edit && !perms.remove && <span style={{ color: 'var(--text3)' }}>—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && <ReviewModal review={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
