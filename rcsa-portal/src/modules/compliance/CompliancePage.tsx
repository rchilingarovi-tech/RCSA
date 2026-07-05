import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Ring } from '../../components/charts/Ring';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { complianceRepo } from './repo';
import {
  CONTROL_STATUSES,
  FRAMEWORKS,
  coverage,
  statusColor,
  type ComplianceControl,
  type ControlStatus,
  type Framework,
} from './types';

const ringColor = (pct: number) => (pct >= 80 ? 'var(--low)' : pct >= 50 ? 'var(--med)' : 'var(--crit)');
const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function ControlModal({
  control,
  onClose,
  onSave,
}: {
  control: ComplianceControl | 'new';
  onClose: () => void;
  onSave: (c: ComplianceControl) => void;
}) {
  const ui = useUi();
  const editing = control === 'new' ? null : control;
  const [framework, setFramework] = useState<Framework>(editing?.framework ?? FRAMEWORKS[0]);
  const [ref, setRef] = useState(editing?.ref ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [domain, setDomain] = useState(editing?.domain ?? '');
  const [status, setStatus] = useState<ControlStatus>(editing?.status ?? 'Not Started');
  const [evidence, setEvidence] = useState<boolean>(editing?.evidence ?? false);
  const [owner, setOwner] = useState(editing?.owner ?? '');
  const [assessed, setAssessed] = useState(editing?.assessed ?? '');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!ref.trim()) { ui.toast('Enter a control reference.', 'bg-orange-600'); return; }
    if (!title.trim()) { ui.toast('Enter a control title.', 'bg-orange-600'); return; }
    onSave({
      id: editing ? editing.id : complianceRepo.nextId(),
      framework,
      ref: ref.trim(),
      title: title.trim(),
      domain: domain.trim(),
      status,
      evidence,
      owner: owner.trim(),
      assessed,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit Control — ${editing.ref}` : 'New Control'}
      subtitle="Framework control assessment"
      maxWidth="max-w-xl"
    >
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Framework</label>
            <select value={framework} onChange={(e) => setFramework(e.target.value as Framework)} className={field}>
              {FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Reference *</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={field} placeholder="e.g. A.8.7" />
          </div>
        </div>
        <div>
          <label className={lbl}>Title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Control title" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Domain</label>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} className={field} placeholder="e.g. Technological" />
          </div>
          <div>
            <label className={lbl}>Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={field} placeholder="Name / team" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ControlStatus)} className={field}>
              {CONTROL_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Evidence</label>
            <select value={evidence ? 'Yes' : 'No'} onChange={(e) => setEvidence(e.target.value === 'Yes')} className={field}>
              <option>No</option>
              <option>Yes</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Assessed</label>
            <input type="date" value={assessed} onChange={(e) => setAssessed(e.target.value)} className={field} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Control</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function CompliancePage() {
  const ui = useUi();
  const perms = usePermissions('compliance');
  const [controls, setControls] = useState<ComplianceControl[]>(() => complianceRepo.list());
  const [framework, setFramework] = useState<Framework>(FRAMEWORKS[0]);
  const [gapOnly, setGapOnly] = useState(false);
  const [editing, setEditing] = useState<ComplianceControl | 'new' | null>(null);

  const byFramework = useMemo(() => {
    const map = {} as Record<Framework, ComplianceControl[]>;
    FRAMEWORKS.forEach((f) => (map[f] = controls.filter((c) => c.framework === f)));
    return map;
  }, [controls]);

  const active = byFramework[framework];
  const stats = useMemo(() => ({
    implemented: active.filter((c) => c.status === 'Implemented').length,
    progress: active.filter((c) => c.status === 'In Progress').length,
    notStarted: active.filter((c) => c.status === 'Not Started').length,
    na: active.filter((c) => c.status === 'Not Applicable').length,
  }), [active]);

  const rows = gapOnly
    ? active.filter((c) => c.status === 'In Progress' || c.status === 'Not Started')
    : active;

  const save = (c: ComplianceControl) => {
    setControls(complianceRepo.save(c));
    setEditing(null);
    ui.toast('Control saved', 'bg-green-700');
  };
  const del = (c: ComplianceControl) =>
    ui.confirm(`Delete ${c.ref}?`, `"${c.title}". This cannot be undone.`, () => {
      setControls(complianceRepo.remove(c.id));
      ui.toast('Control deleted', 'bg-red-700');
    });

  const stat = [
    { label: 'Implemented', value: stats.implemented, color: 'var(--low)' },
    { label: 'In Progress', value: stats.progress, color: 'var(--info)' },
    { label: 'Not Started', value: stats.notStarted, color: 'var(--crit)' },
    { label: 'Not Applicable', value: stats.na, color: 'var(--mut)' },
  ];

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Control</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample controls and discards your changes.', () => { setControls(complianceRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Framework selector */}
        <div className="flex gap-3 flex-wrap">
          {FRAMEWORKS.map((f) => {
            const pct = coverage(byFramework[f]);
            const isActive = f === framework;
            return (
              <button
                key={f}
                onClick={() => setFramework(f)}
                className="section-card flex items-center gap-3 px-4 py-3 text-left flex-1 min-w-[160px]"
                style={{ border: isActive ? '1.5px solid var(--accent)' : undefined, boxShadow: isActive ? '0 0 0 3px var(--accent-soft)' : undefined }}
              >
                <Ring pct={pct} size={48} stroke={6} color={ringColor(pct)} />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate" style={{ color: 'var(--text)' }}>{f}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{byFramework[f].length} controls</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Stats + coverage */}
        <div className="section-card grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center px-6 py-5">
          <div className="flex flex-col items-center gap-1.5">
            <Ring pct={coverage(active)} size={104} stroke={12} color={ringColor(coverage(active))} label="compliant" />
            <div className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{framework}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stat.map((s) => (
              <div key={s.label} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: 12 }}>
                <div className="text-2xl font-bold leading-none" style={{ color: 'var(--text)' }}>{s.value}</div>
                <div className="text-[11.5px] mt-1" style={{ color: 'var(--text3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Control table */}
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800">{framework} Controls</h2>
              <span className="text-xs text-gray-500">{rows.length} of {active.length}</span>
            </div>
            <button
              onClick={() => setGapOnly((g) => !g)}
              className="btn-neutral border rounded px-3 py-1.5 text-xs"
              style={gapOnly ? { borderColor: 'var(--accent)', color: 'var(--accent-d)', background: 'var(--accent-soft)' } : undefined}
            >
              {gapOnly ? '✓ Gap analysis' : 'Gap analysis'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Control</th>
                  <th className={th}>Title</th>
                  <th className={th}>Domain</th>
                  <th className={th}>Status</th>
                  <th className={th}>Evidence</th>
                  <th className={th}>Owner</th>
                  <th className={th}>Assessed</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No controls match.</td></tr>
                ) : (
                  rows.map((c) => (
                    <tr key={c.id} className="risk-row">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{c.ref}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{c.title}</td>
                      <td className="px-4 py-3 text-gray-500">{c.domain}</td>
                      <td className="px-4 py-3"><Pill text={c.status} k={statusColor(c.status)} /></td>
                      <td className="px-4 py-3 text-xs font-semibold" style={{ color: c.evidence ? 'var(--low)' : 'var(--text3)' }}>{c.evidence ? '✓ Yes' : '—'}</td>
                      <td className="px-4 py-3 text-sm">{c.owner || 'Unassigned'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{c.assessed || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <RowActions onEdit={perms.edit ? () => setEditing(c) : undefined} onDelete={perms.remove ? () => del(c) : undefined} editLabel="Edit control" deleteLabel="Delete control" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && <ControlModal control={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
