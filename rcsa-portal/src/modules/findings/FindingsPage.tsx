import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { findingIo } from './io';
import {
  ChartGrid,
  ChartPanel,
  DonutChart,
  HBarChart,
  useChartFilter,
  type BarRow,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { today } from '../../domain/scoring';
import { findingsRepo } from './repo';
import {
  FINDING_SEVERITIES,
  FINDING_SOURCES,
  FINDING_STATUSES,
  isOpenFinding,
  overdue,
  overdueDays,
  severityTone,
  sourceTone,
  statusTone,
  type Finding,
  type FindingSeverity,
  type FindingSource,
  type FindingStatus,
} from './types';

const todayStr = today;

function FindingModal({ finding, onClose, onSave }: { finding: Finding | 'new'; onClose: () => void; onSave: (f: Finding) => void }) {
  const ui = useUi();
  const e = finding === 'new' ? null : finding;
  const [title, setTitle] = useState(e?.title ?? '');
  const [source, setSource] = useState<FindingSource>(e?.source ?? 'Internal Audit');
  const [ref, setRef] = useState(e?.ref ?? '');
  const [severity, setSeverity] = useState<FindingSeverity>(e?.severity ?? 'Medium');
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [dueDate, setDueDate] = useState(e?.dueDate ?? todayStr());
  const [status, setStatus] = useState<FindingStatus>(e?.status ?? 'Open');
  const [description, setDescription] = useState(e?.description ?? '');
  const [actionPlan, setActionPlan] = useState(e?.actionPlan ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a finding title.', 'bg-orange-600'); return; }
    if (!owner.trim()) { ui.toast('Enter a remediation owner.', 'bg-orange-600'); return; }
    if (!dueDate) { ui.toast('Set a remediation due date.', 'bg-orange-600'); return; }
    onSave({
      id: e ? e.id : findingsRepo.nextId(),
      title: title.trim(),
      source,
      ref: ref.trim(),
      severity,
      owner: owner.trim(),
      dueDate,
      status,
      description: description.trim(),
      actionPlan: actionPlan.trim(),
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Finding — ${e.id}` : 'New Finding'} subtitle="Audit / regulator finding" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} maxLength={200} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. Privileged access reviews not performed quarterly" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Source</label><select value={source} onChange={(ev) => setSource(ev.target.value as FindingSource)} className={field}>{FINDING_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Report reference</label><input value={ref} maxLength={60} onChange={(ev) => setRef(ev.target.value)} className={field} placeholder="e.g. NBG-2026-11 §4.2" /></div>
          <div><label className={lbl}>Severity</label><select value={severity} onChange={(ev) => setSeverity(ev.target.value as FindingSeverity)} className={field}>{FINDING_SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as FindingStatus)} className={field}>{FINDING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Remediation owner *</label><input value={owner} maxLength={120} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Team / person" /></div>
          <div><label className={lbl}>Due date *</label><input type="date" value={dueDate} onChange={(ev) => setDueDate(ev.target.value)} className={field} /></div>
        </div>
        <div><label className={lbl}>Finding description</label><textarea value={description} maxLength={2000} onChange={(ev) => setDescription(ev.target.value)} className={field} rows={3} placeholder="What the audit found…" /></div>
        <div><label className={lbl}>Remediation action plan</label><textarea value={actionPlan} maxLength={2000} onChange={(ev) => setActionPlan(ev.target.value)} className={field} rows={3} placeholder="How it will be fixed…" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Finding' : 'Create Finding'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function FindingsPage() {
  const ui = useUi();
  const perms = usePermissions('findings');
  const [findings, setFindings] = useState<Finding[]>(() => findingsRepo.list());
  const [editing, setEditing] = useState<Finding | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Finding>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.findings.v1') setFindings(findingsRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ── Charts ──
  const sevSeg: DonutSegment[] = FINDING_SEVERITIES.map((s) => ({
    key: `sev:${s}`, label: s, tone: severityTone[s] as Tone, value: findings.filter((f) => f.severity === s && isOpenFinding(f)).length,
  }));
  const statusRows: BarRow[] = FINDING_STATUSES.map((s) => ({
    key: `st:${s}`, label: s, tone: statusTone[s] as Tone, value: findings.filter((f) => f.status === s).length,
  }));

  const selectSev = (key: string) => { const s = key.slice(4) as FindingSeverity; filter.select(key, s, (f) => f.severity === s && isOpenFinding(f)); };
  const selectStatus = (key: string) => { const s = key.slice(3) as FindingStatus; filter.select(key, s, (f) => f.status === s); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  // Signature widget: Source × Severity accountability matrix (open findings) —
  // the grid a regulator asks for. Each cell click-filters the register.
  const SHORT_SRC: Record<FindingSource, string> = { 'NBG Inspection': 'NBG', 'Internal Audit': 'Internal', 'External Audit': 'External', 'Self-identified': 'Self' };
  const matrixCell = (src: FindingSource, sev: FindingSeverity) =>
    findings.filter((f) => isOpenFinding(f) && f.source === src && f.severity === sev).length;

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return findings;
    return findings.filter((f) => [f.id, f.title, f.ref, f.owner, f.source, f.severity, f.status].join(' ').toLowerCase().includes(s));
  }, [findings, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (f: Finding) => { setFindings(findingsRepo.save(f)); setEditing(null); ui.toast('Finding saved', 'bg-green-700'); };
  const del = (f: Finding) => ui.confirm(`Delete "${f.id}"?`, 'This cannot be undone.', () => { setFindings(findingsRepo.remove(f.id)); ui.toast('Finding deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample findings and discards your changes.', () => { setFindings(findingsRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const open = findings.filter(isOpenFinding);
  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'Findings', v: findings.length },
    { l: 'Open', v: open.length, t: 'high' },
    { l: 'Overdue', v: findings.filter(overdue).length, t: 'crit' },
    { l: 'Critical / High open', v: open.filter((f) => f.severity === 'Critical' || f.severity === 'High').length, t: 'crit' },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Stat strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
        {stats.map((s) => (
          <div key={s.l} className="section-card p-4">
            <div className="tabular-nums text-2xl font-bold" style={{ color: s.t ? `var(--${s.t})` : 'var(--text)' }}>{s.v}</div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text3)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Interactive charts */}
      <ChartGrid>
        <ChartPanel title="Open by severity" span={4} filterLabel={chipFor('sev:')} onClearFilter={filter.clear}>
          <DonutChart segments={sevSeg} center={String(open.length)} sub="open" activeKey={filter.activeKey} onSelect={selectSev} />
        </ChartPanel>
        <ChartPanel title="By status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <HBarChart rows={statusRows} activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
        <ChartPanel title="Source × severity matrix" span={4} filterLabel={chipFor('mx:')} onClearFilter={filter.clear}>
          <div>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(4, 1fr)' }}>
              <div />
              {FINDING_SEVERITIES.map((sev) => (
                <div key={sev} className="text-center text-[9.5px] font-bold uppercase tracking-wide pb-0.5" style={{ color: `var(--${severityTone[sev]})` }}>{sev === 'Critical' ? 'Crit' : sev}</div>
              ))}
              {FINDING_SOURCES.map((src) => (
                <div key={src} className="contents">
                  <div className="flex items-center justify-end pr-1.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--text2)' }}>
                    <span className="w-2 h-2 rounded-sm mr-1.5 shrink-0" style={{ background: `var(--${sourceTone[src]})` }} />{SHORT_SRC[src]}
                  </div>
                  {FINDING_SEVERITIES.map((sev) => {
                    const n = matrixCell(src, sev);
                    const key = `mx:${src}|${sev}`;
                    const active = filter.activeKey === key;
                    return (
                      <button
                        key={sev}
                        onClick={() => filter.select(key, `${SHORT_SRC[src]} · ${sev}`, (f) => isOpenFinding(f) && f.source === src && f.severity === sev)}
                        title={`${src} · ${sev}: ${n} open`}
                        className="rounded-md py-2 text-[13px] font-bold tabular-nums transition-transform hover:scale-105"
                        style={{
                          background: n > 0 ? `var(--${severityTone[sev]})` : 'var(--surface3)',
                          color: n > 0 ? '#fff' : 'var(--text3)',
                          opacity: n > 0 ? 1 : 0.6,
                          outline: active ? '2px solid var(--accent)' : 'none',
                          outlineOffset: 1,
                        }}
                      >
                        {n > 0 ? n : '·'}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="text-[10.5px] mt-2 text-center" style={{ color: 'var(--text3)' }}>Open findings · click a cell to filter</div>
          </div>
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search findings…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={findingIo} exportSource={rows} existing={findings} canImport={perms.create} canExport={perms.export} onImported={(items) => setFindings(findingsRepo.bulkSave(items))} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Finding</button>}
      </div>

      {/* Register */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Finding</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Owner</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No findings match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((f) => {
                const late = overdue(f);
                return (
                  <tr key={f.id} className="risk-row cursor-pointer" onClick={() => perms.edit && setEditing(f)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{f.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold max-w-[320px] truncate" title={f.title} style={{ color: 'var(--text)' }}>{f.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{f.ref || '—'}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><Pill text={f.source} k={sourceTone[f.source]} /></td>
                    <td className="px-4 py-3"><Pill text={f.severity} k={severityTone[f.severity]} /></td>
                    <td className="px-4 py-3 text-[12px] hidden sm:table-cell" style={{ color: 'var(--text2)' }}>{f.owner}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {late
                        ? <Pill text={`${f.dueDate} · ${overdueDays(f)}d late`} k="crit" />
                        : <span style={{ color: 'var(--text2)' }}>{f.dueDate || '—'}</span>}
                    </td>
                    <td className="px-4 py-3"><Pill text={f.status} k={statusTone[f.status]} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {perms.edit || perms.remove
                        ? <RowActions onEdit={perms.edit ? () => setEditing(f) : undefined} onDelete={perms.remove ? () => del(f) : undefined} editLabel="Edit finding" deleteLabel="Delete finding" />
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <FindingModal finding={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
