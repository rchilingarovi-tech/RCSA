import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
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
import { downloadCsv } from '../../lib/csv';
import { today } from '../../domain/scoring';
import { incidentRepo } from './repo';
import {
  CATEGORIES,
  INCIDENT_STATUSES,
  SEVERITIES,
  categoryLabel,
  isActive,
  severityToken,
  statusToken,
  timeToCloseDays,
  type Incident,
  type IncidentCategory,
  type IncidentStatus,
  type Severity,
} from './types';

const SEV_TONE = severityToken as Record<Severity, Tone>;
const ST_TONE = statusToken as Record<IncidentStatus, Tone>;

// ── Add / edit modal ──────────────────────────────────────────────────────────
function IncidentModal({ incident, onClose, onSave }: { incident: Incident | 'new'; onClose: () => void; onSave: (i: Incident) => void }) {
  const ui = useUi();
  const e = incident === 'new' ? null : incident;
  const [title, setTitle] = useState(e?.title ?? '');
  const [severity, setSeverity] = useState<Severity>(e?.severity ?? 'Medium');
  const [status, setStatus] = useState<IncidentStatus>(e?.status ?? 'Open');
  const [category, setCategory] = useState<IncidentCategory>(e?.category ?? 'Phishing');
  const [categoryOther, setCategoryOther] = useState(e?.categoryOther ?? '');
  const [opened, setOpened] = useState(e?.opened ?? today);
  const [closed, setClosed] = useState(e?.closed ?? '');
  const [rootCause, setRootCause] = useState(e?.rootCause ?? '');
  const [corrective, setCorrective] = useState(e?.corrective ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter an incident title.', 'bg-orange-600'); return; }
    if (opened && closed && closed < opened) { ui.toast('Closed date cannot be before opened.', 'bg-orange-600'); return; }
    const resolvedClosed = status === 'Closed' ? (closed || today) : '';
    onSave({
      id: e ? e.id : incidentRepo.nextId(),
      title: title.trim(),
      severity,
      status,
      category,
      categoryOther: category === 'Other' ? categoryOther.trim() : '',
      rootCause: rootCause.trim(),
      corrective: corrective.trim(),
      opened,
      closed: resolvedClosed,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Incident — ${e.id}` : 'Report New Incident'} subtitle="Security incident record" maxWidth="max-w-2xl">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. Phishing email bypassed gateway" /></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={lbl}>Severity</label><select value={severity} onChange={(ev) => setSeverity(ev.target.value as Severity)} className={field}>{SEVERITIES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as IncidentStatus)} className={field}>{INCIDENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Category</label><select value={category} onChange={(ev) => setCategory(ev.target.value as IncidentCategory)} className={field}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={lbl}>Opened</label><input type="date" value={opened} onChange={(ev) => setOpened(ev.target.value)} className={field} /></div>
        </div>

        {category === 'Other' && (
          <div><label className={lbl}>Specify category</label><input value={categoryOther} onChange={(ev) => setCategoryOther(ev.target.value)} className={field} placeholder="Describe the incident category" /></div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Closed date</label><input type="date" value={closed} onChange={(ev) => setClosed(ev.target.value)} className={field} disabled={status !== 'Closed'} title={status !== 'Closed' ? 'Set status to Closed to record a closure date' : ''} /></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className={lbl}>Root cause</label><textarea value={rootCause} onChange={(ev) => setRootCause(ev.target.value)} className={field} rows={3} placeholder="Underlying cause (post-investigation)" /></div>
          <div><label className={lbl}>Corrective action</label><textarea value={corrective} onChange={(ev) => setCorrective(ev.target.value)} className={field} rows={3} placeholder="Remedial / corrective action taken" /></div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Incident' : 'Report Incident'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function IncidentsPage() {
  const ui = useUi();
  const perms = usePermissions('incidents');
  const [incidents, setIncidents] = useState<Incident[]>(() => incidentRepo.list());
  const [editing, setEditing] = useState<Incident | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Incident>();

  const active = incidents.filter(isActive);

  const sevSeg: DonutSegment[] = SEVERITIES.map((s) => ({ key: `sev:${s}`, label: s, tone: SEV_TONE[s], value: incidents.filter((i) => i.severity === s).length }));
  const statusRows: BarRow[] = INCIDENT_STATUSES.map((s) => ({ key: `st:${s}`, label: s, tone: ST_TONE[s], value: incidents.filter((i) => i.status === s).length }));
  const categories = useMemo(() => [...new Set(incidents.map(categoryLabel))], [incidents]);
  const catRows: BarRow[] = categories
    .map((c) => ({ key: `cat:${c}`, label: c, tone: 'info' as Tone, value: incidents.filter((i) => categoryLabel(i) === c).length }))
    .sort((a, b) => b.value - a.value);

  const selectSev = (key: string) => { const s = key.slice(4) as Severity; filter.select(key, s, (i) => i.severity === s); };
  const selectStatus = (key: string) => { const s = key.slice(3) as IncidentStatus; filter.select(key, s, (i) => i.status === s); };
  const selectCat = (key: string) => { const c = key.slice(4); filter.select(key, c, (i) => categoryLabel(i) === c); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return incidents;
    return incidents.filter((i) => [i.id, i.title, i.severity, i.status, categoryLabel(i), i.rootCause].join(' ').toLowerCase().includes(s));
  }, [incidents, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (i: Incident) => { setIncidents(incidentRepo.save(i)); setEditing(null); ui.toast('Incident saved', 'bg-green-700'); };
  const del = (i: Incident) => ui.confirm(`Delete "${i.id}"?`, 'This cannot be undone.', () => { setIncidents(incidentRepo.remove(i.id)); ui.toast('Incident deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample incidents and discards your changes.', () => { setIncidents(incidentRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const exportCsv = () => downloadCsv(
    `incidents-${today}.csv`,
    ['ID', 'Title', 'Severity', 'Status', 'Category', 'Opened', 'Closed', 'Time to close (d)', 'Root cause', 'Corrective action'],
    rows.map((i) => [i.id, i.title, i.severity, i.status, categoryLabel(i), i.opened, i.closed, timeToCloseDays(i) ?? '', i.rootCause, i.corrective]),
  );

  const closed = incidents.filter((i) => i.closed);
  const avgClose = closed.length
    ? Math.round((closed.reduce((s, i) => s + (timeToCloseDays(i) ?? 0), 0) / closed.length) * 10) / 10
    : null;

  const stats: { l: string; v: string | number; t?: Tone }[] = [
    { l: 'Incidents', v: incidents.length },
    { l: 'Open / active', v: active.length, t: 'high' },
    { l: 'Critical active', v: active.filter((i) => i.severity === 'Critical').length, t: 'crit' },
    { l: 'Avg time to close', v: avgClose == null ? '—' : `${avgClose} d`, t: 'ok' },
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

      {/* Charts */}
      <ChartGrid>
        <ChartPanel title="Severity (all)" span={4} filterLabel={chipFor('sev:')} onClearFilter={filter.clear}>
          <DonutChart segments={sevSeg} center={String(active.length)} sub="active now" activeKey={filter.activeKey} onSelect={selectSev} />
        </ChartPanel>
        <ChartPanel title="Pipeline status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <HBarChart rows={statusRows} activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
        <ChartPanel title="By category" span={4} filterLabel={chipFor('cat:')} onClearFilter={filter.clear}>
          <HBarChart rows={catRows} activeKey={filter.activeKey} onSelect={selectCat} />
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search incidents…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        {perms.export && <button onClick={exportCsv} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ Report Incident</button>}
      </div>

      {/* Table */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">Incident</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Time to close</th>
                <th className="text-left px-4 py-3">Root cause</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No incidents match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((i) => {
                const ttc = timeToCloseDays(i);
                return (
                  <tr key={i.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{i.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{categoryLabel(i)} · opened {i.opened}</div>
                    </td>
                    <td className="px-4 py-3"><Pill text={i.severity} k={SEV_TONE[i.severity]} /></td>
                    <td className="px-4 py-3"><Pill text={i.status} k={ST_TONE[i.status]} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text2)' }}>{ttc == null ? '—' : `${ttc} d`}</td>
                    <td className="px-4 py-3 text-sm max-w-[280px]">
                      {i.rootCause ? <span style={{ color: 'var(--text2)' }}>{i.rootCause}</span> : <span style={{ color: 'var(--text3)' }}>pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        {perms.edit && <button onClick={() => setEditing(i)} className="text-blue-600 hover:underline">Edit</button>}
                        {perms.remove && <button onClick={() => del(i)} className="text-red-500 hover:underline">Delete</button>}
                        {!perms.edit && !perms.remove && <span style={{ color: 'var(--text3)' }}>—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <IncidentModal incident={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
