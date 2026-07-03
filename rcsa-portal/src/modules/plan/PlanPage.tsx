import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { planRepo } from './repo';
import {
  PLAN_STATUSES,
  PRIORITIES,
  priorityColor,
  statusColor,
  type Initiative,
  type PlanStatus,
  type Priority,
} from './types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function InitiativeModal({ initiative, onClose, onSave }: { initiative: Initiative | 'new'; onClose: () => void; onSave: (i: Initiative) => void }) {
  const ui = useUi();
  const e = initiative === 'new' ? null : initiative;
  const [name, setName] = useState(e?.name ?? '');
  const [category, setCategory] = useState(e?.category ?? '');
  const [quarter, setQuarter] = useState(e?.quarter ?? '');
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [priority, setPriority] = useState<Priority>(e?.priority ?? 'Medium');
  const [status, setStatus] = useState<PlanStatus>(e?.status ?? 'Planned');
  const [progress, setProgress] = useState(String(e?.progress ?? 0));

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter an initiative name.', 'bg-orange-600'); return; }
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    onSave({
      id: e ? e.id : planRepo.nextId(),
      name: name.trim(),
      category: category.trim(),
      quarter: quarter.trim(),
      owner: owner.trim(),
      priority,
      status,
      progress: status === 'Completed' ? 100 : p,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Initiative — ${e.id}` : 'New Initiative'} subtitle="Annual roadmap item" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Name *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Zero Trust Network Rollout" /></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><label className={lbl}>Category</label><input value={category} onChange={(ev) => setCategory(ev.target.value)} className={field} placeholder="e.g. Compliance" /></div>
          <div><label className={lbl}>Quarter</label><input value={quarter} onChange={(ev) => setQuarter(ev.target.value)} className={field} placeholder="Q1–Q3" /></div>
          <div><label className={lbl}>Owner</label><input value={owner} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Name / team" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Priority</label>
            <select value={priority} onChange={(ev) => setPriority(ev.target.value as Priority)} className={field}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as PlanStatus)} className={field}>{PLAN_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div><label className={lbl}>Progress (%)</label><input value={progress} onChange={(ev) => setProgress(ev.target.value)} className={field} inputMode="numeric" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Initiative</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function PlanPage() {
  const ui = useUi();
  const perms = usePermissions('yearly-plan');
  const [items, setItems] = useState<Initiative[]>(() => planRepo.list());
  const [editing, setEditing] = useState<Initiative | 'new' | null>(null);

  const chips = useMemo(() => {
    const prog = items.length ? Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length) : 0;
    return [
      { label: 'Initiatives', value: items.length, color: 'var(--text)' },
      { label: 'In Progress', value: items.filter((i) => i.status === 'In Progress').length, color: 'var(--info)' },
      { label: 'Completed', value: items.filter((i) => i.status === 'Completed').length, color: 'var(--low)' },
      { label: 'Overall Progress', value: `${prog}%`, color: 'var(--accent)' },
    ];
  }, [items]);

  const save = (i: Initiative) => { setItems(planRepo.save(i)); setEditing(null); ui.toast('Initiative saved', 'bg-green-700'); };
  const del = (i: Initiative) => ui.confirm(`Delete "${i.name}"?`, 'This cannot be undone.', () => { setItems(planRepo.remove(i.id)); ui.toast('Initiative deleted', 'bg-red-700'); });

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Initiative</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample roadmap and discards your changes.', () => { setItems(planRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
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
            <h2 className="text-base font-semibold text-gray-800">Annual InfoSec Roadmap</h2>
            <span className="text-xs text-gray-500">{items.length} initiatives</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>ID</th>
                  <th className={th}>Initiative</th>
                  <th className={th}>Category</th>
                  <th className={th}>Quarter</th>
                  <th className={th}>Owner</th>
                  <th className={th}>Priority</th>
                  <th className={th}>Status</th>
                  <th className={th}>Progress</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No initiatives yet — add one to get started.</td></tr>
                ) : (
                  items.map((i) => (
                    <tr key={i.id} className="risk-row">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{i.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{i.name}</td>
                      <td className="px-4 py-3 text-gray-500">{i.category}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{i.quarter}</td>
                      <td className="px-4 py-3 text-sm">{i.owner || 'Unassigned'}</td>
                      <td className="px-4 py-3"><Pill text={i.priority} k={priorityColor(i.priority)} /></td>
                      <td className="px-4 py-3"><Pill text={i.status} k={statusColor(i.status)} /></td>
                      <td className="px-4 py-3"><ProgressBar pct={i.progress} color={i.progress === 100 ? 'var(--low)' : 'var(--accent)'} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs">
                          {perms.edit && <button onClick={() => setEditing(i)} className="text-blue-600 hover:underline">Edit</button>}
                          {perms.remove && <button onClick={() => del(i)} className="text-red-500 hover:underline">Delete</button>}
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

      {editing && <InitiativeModal initiative={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
