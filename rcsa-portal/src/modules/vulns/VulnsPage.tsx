import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
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
import { vulnRepo } from './repo';
import {
  SLA_DAYS,
  VULN_SEVERITIES,
  VULN_SOURCES,
  VULN_STATUSES,
  isOpenVuln,
  severityTone,
  slaBreached,
  slaDaysLeft,
  slaDeadline,
  sourceTone,
  statusTone,
  type Vuln,
  type VulnSeverity,
  type VulnSource,
  type VulnStatus,
} from './types';

const todayStr = () => new Date().toISOString().slice(0, 10);

function VulnModal({ vuln, onClose, onSave }: { vuln: Vuln | 'new'; onClose: () => void; onSave: (v: Vuln) => void }) {
  const ui = useUi();
  const e = vuln === 'new' ? null : vuln;
  const [title, setTitle] = useState(e?.title ?? '');
  const [source, setSource] = useState<VulnSource>(e?.source ?? 'Vulnerability Scan');
  const [ref, setRef] = useState(e?.ref ?? '');
  const [asset, setAsset] = useState(e?.asset ?? '');
  const [severity, setSeverity] = useState<VulnSeverity>(e?.severity ?? 'Medium');
  const [cvss, setCvss] = useState(e?.cvss ?? '');
  const [discovered, setDiscovered] = useState(e?.discovered ?? todayStr());
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [status, setStatus] = useState<VulnStatus>(e?.status ?? 'Open');
  const [description, setDescription] = useState(e?.description ?? '');
  const [remediation, setRemediation] = useState(e?.remediation ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a vulnerability title.', 'bg-orange-600'); return; }
    if (!owner.trim()) { ui.toast('Enter a remediation owner.', 'bg-orange-600'); return; }
    if (!discovered) { ui.toast('Set the discovery date.', 'bg-orange-600'); return; }
    if (discovered > todayStr()) { ui.toast('Discovery date cannot be in the future.', 'bg-orange-600'); return; }
    if (cvss.trim() !== '') {
      const n = Number(cvss);
      if (!Number.isFinite(n) || n < 0 || n > 10) { ui.toast('CVSS must be a number between 0 and 10.', 'bg-orange-600'); return; }
    }
    onSave({
      id: e ? e.id : vulnRepo.nextId(),
      title: title.trim(),
      source,
      ref: ref.trim(),
      asset: asset.trim(),
      severity,
      cvss: cvss.trim(),
      discovered,
      owner: owner.trim(),
      status,
      description: description.trim(),
      remediation: remediation.trim(),
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';
  const deadline = discovered ? slaDeadline({ discovered, severity }) : '';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Vulnerability — ${e.id}` : 'New Vulnerability'} subtitle="Scan / pentest finding" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} maxLength={200} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. SQL injection in loan-application search" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Source</label><select value={source} onChange={(ev) => setSource(ev.target.value as VulnSource)} className={field}>{VULN_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Reference / CVE</label><input value={ref} maxLength={60} onChange={(ev) => setRef(ev.target.value)} className={field} placeholder="e.g. PT-2026-02 F-04" /></div>
          <div><label className={lbl}>Severity</label><select value={severity} onChange={(ev) => setSeverity(ev.target.value as VulnSeverity)} className={field}>{VULN_SEVERITIES.map((s) => <option key={s}>{s} — SLA {SLA_DAYS[s]}d</option>)}</select></div>
          <div><label className={lbl}>CVSS (optional)</label><input value={cvss} maxLength={4} onChange={(ev) => setCvss(ev.target.value)} className={field} inputMode="decimal" placeholder="0–10" /></div>
          <div><label className={lbl}>Discovered *</label><input type="date" value={discovered} onChange={(ev) => setDiscovered(ev.target.value)} className={field} /></div>
          <div>
            <label className={lbl}>SLA deadline (derived)</label>
            <div className={`${field} bg-gray-50`} style={{ color: 'var(--text2)' }}>{deadline || '—'}</div>
          </div>
          <div><label className={lbl}>Remediation owner *</label><input value={owner} maxLength={120} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Team / person" /></div>
          <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as VulnStatus)} className={field}>{VULN_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div><label className={lbl}>Affected asset / system</label><input value={asset} maxLength={120} onChange={(ev) => setAsset(ev.target.value)} className={field} placeholder="e.g. Mobile Banking API" /></div>
        <div><label className={lbl}>Technical detail</label><textarea value={description} maxLength={2000} onChange={(ev) => setDescription(ev.target.value)} className={field} rows={3} placeholder="What was found and how it can be abused…" /></div>
        <div><label className={lbl}>Remediation plan</label><textarea value={remediation} maxLength={2000} onChange={(ev) => setRemediation(ev.target.value)} className={field} rows={3} placeholder="How it will be fixed / compensating controls…" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Vulnerability' : 'Create Vulnerability'}</button>
        </div>
      </form>
    </Modal>
  );
}

type SlaBand = 'Breached' | 'Due ≤ 7 days' | 'Within SLA';
const slaBand = (v: Vuln): SlaBand | null => {
  if (!isOpenVuln(v)) return null;
  const left = slaDaysLeft(v);
  if (left == null) return null;
  if (left < 0) return 'Breached';
  if (left <= 7) return 'Due ≤ 7 days';
  return 'Within SLA';
};
const SLA_BANDS: { label: SlaBand; tone: Tone }[] = [
  { label: 'Breached', tone: 'crit' },
  { label: 'Due ≤ 7 days', tone: 'med' },
  { label: 'Within SLA', tone: 'low' },
];

export function VulnsPage() {
  const ui = useUi();
  const perms = usePermissions('vulns');
  const [vulns, setVulns] = useState<Vuln[]>(() => vulnRepo.list());
  const [editing, setEditing] = useState<Vuln | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Vuln>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.vulns.v1') setVulns(vulnRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const open = vulns.filter(isOpenVuln);

  // ── Charts ──
  const sevSeg: DonutSegment[] = VULN_SEVERITIES.map((s) => ({
    key: `sev:${s}`, label: s, tone: severityTone[s] as Tone, value: open.filter((v) => v.severity === s).length,
  }));
  const slaRows: BarRow[] = SLA_BANDS.map((b) => ({
    key: `sla:${b.label}`, label: b.label, tone: b.tone, value: open.filter((v) => slaBand(v) === b.label).length,
  }));
  const statusRows: BarRow[] = VULN_STATUSES.map((s) => ({
    key: `st:${s}`, label: s, tone: statusTone[s] as Tone, value: vulns.filter((v) => v.status === s).length,
  }));

  const selectSev = (key: string) => { const s = key.slice(4) as VulnSeverity; filter.select(key, s, (v) => v.severity === s && isOpenVuln(v)); };
  const selectSla = (key: string) => { const b = key.slice(4) as SlaBand; filter.select(key, b, (v) => slaBand(v) === b); };
  const selectStatus = (key: string) => { const s = key.slice(3) as VulnStatus; filter.select(key, s, (v) => v.status === s); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vulns;
    return vulns.filter((v) => [v.id, v.title, v.ref, v.asset, v.owner, v.source, v.severity, v.status].join(' ').toLowerCase().includes(s));
  }, [vulns, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (v: Vuln) => { setVulns(vulnRepo.save(v)); setEditing(null); ui.toast('Vulnerability saved', 'bg-green-700'); };
  const del = (v: Vuln) => ui.confirm(`Delete "${v.id}"?`, 'This cannot be undone.', () => { setVulns(vulnRepo.remove(v.id)); ui.toast('Vulnerability deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample vulnerabilities and discards your changes.', () => { setVulns(vulnRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const exportCsv = () => downloadCsv(
    `vulnerabilities-${today()}.csv`,
    ['ID', 'Title', 'Source', 'Reference', 'Asset', 'Severity', 'CVSS', 'Discovered', 'SLA Deadline', 'Days Left', 'Owner', 'Status'],
    rows.map((v) => [v.id, v.title, v.source, v.ref, v.asset, v.severity, v.cvss, v.discovered, slaDeadline(v), slaDaysLeft(v) ?? '', v.owner, v.status]),
  );

  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'Vulnerabilities', v: vulns.length },
    { l: 'Open', v: open.length, t: 'high' },
    { l: 'SLA breached', v: vulns.filter(slaBreached).length, t: 'crit' },
    { l: 'Critical / High open', v: open.filter((v) => v.severity === 'Critical' || v.severity === 'High').length, t: 'crit' },
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
        <ChartPanel title="SLA position (open items)" span={4} filterLabel={chipFor('sla:')} onClearFilter={filter.clear}>
          <HBarChart rows={slaRows} activeKey={filter.activeKey} onSelect={selectSla} />
        </ChartPanel>
        <ChartPanel title="By status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <HBarChart rows={statusRows} activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vulnerabilities…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        {perms.export && <button onClick={exportCsv} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Vulnerability</button>}
      </div>

      {/* Register */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">Vulnerability</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Source</th>
                <th className="text-left px-4 py-3">Severity</th>
                <th className="text-left px-4 py-3">SLA deadline</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Owner</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No vulnerabilities match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((v) => {
                const left = slaDaysLeft(v);
                const openItem = isOpenVuln(v);
                return (
                  <tr key={v.id} className="risk-row cursor-pointer" onClick={() => perms.edit && setEditing(v)}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{v.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold max-w-[300px] truncate" title={v.title} style={{ color: 'var(--text)' }}>{v.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{v.asset || '—'}{v.ref ? ` · ${v.ref}` : ''}</div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><Pill text={v.source} k={sourceTone[v.source]} /></td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Pill text={v.severity} k={severityTone[v.severity]} />
                        {v.cvss && <span className="text-[10.5px] font-mono" style={{ color: 'var(--text3)' }}>{v.cvss}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {!openItem || left == null
                        ? <span style={{ color: 'var(--text3)' }}>—</span>
                        : left < 0
                          ? <Pill text={`${slaDeadline(v)} · ${Math.abs(left)}d over`} k="crit" />
                          : left <= 7
                            ? <Pill text={`${slaDeadline(v)} · ${left}d left`} k="med" />
                            : <span style={{ color: 'var(--text2)' }}>{slaDeadline(v)}</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] hidden sm:table-cell" style={{ color: 'var(--text2)' }}>{v.owner}</td>
                    <td className="px-4 py-3"><Pill text={v.status} k={statusTone[v.status]} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {perms.edit || perms.remove
                        ? <RowActions onEdit={perms.edit ? () => setEditing(v) : undefined} onDelete={perms.remove ? () => del(v) : undefined} editLabel="Edit vulnerability" deleteLabel="Delete vulnerability" />
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

      {editing && <VulnModal vuln={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
