import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { FormSection } from '../../components/common/FormSection';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { vulnIo } from './io';
import {
  ChartGrid,
  ChartPanel,
  DonutChart,
  useChartFilter,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { today } from '../../domain/scoring';
import { takeIntent, takeOpenIntent } from '../../lib/intent';
import { RecordDrawer } from '../../components/common/RecordDrawer';
import { Icon } from '../../components/common/Icon';
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

const todayStr = today;

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

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  // The fix plan follows triage; only the owner is expected up front.
  const remediationPending = status === 'Open' && !remediation;

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
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Vulnerability — ${e.id}` : 'New Vulnerability'} subtitle="Scan / pentest finding" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6">
        <FormSection first title="The vulnerability" hint="What was found, where, and how severe — this sets the remediation clock.">
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
          </div>
          <div><label className={lbl}>Affected asset / system</label><input value={asset} maxLength={120} onChange={(ev) => setAsset(ev.target.value)} className={field} placeholder="e.g. Mobile Banking API" /></div>
          <div><label className={lbl}>Technical detail</label><textarea value={description} maxLength={2000} onChange={(ev) => setDescription(ev.target.value)} className={field} rows={3} placeholder="What was found and how it can be abused…" /></div>
        </FormSection>

        <FormSection
          title="Remediation"
          muted={remediationPending}
          hint={remediationPending
            ? 'Assign an owner now; the plan can follow once triage is done.'
            : 'Who owns the fix and how it will be done.'}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={lbl}>Remediation owner *</label><input value={owner} maxLength={120} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Team / person" /></div>
            <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as VulnStatus)} className={field}>{VULN_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className={lbl}>Remediation plan</label><textarea value={remediation} maxLength={2000} onChange={(ev) => setRemediation(ev.target.value)} className={field} rows={3} placeholder="How it will be fixed / compensating controls…" /></div>
        </FormSection>

        <div className="flex justify-end gap-3 pt-5 mt-5 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Vulnerability' : 'Create Vulnerability'}</button>
        </div>
      </form>
    </Modal>
  );
}


export function VulnsPage() {
  const ui = useUi();
  const perms = usePermissions('vulns');
  const [vulns, setVulns] = useState<Vuln[]>(() => vulnRepo.list());
  const [editing, setEditing] = useState<Vuln | 'new' | null>(() => (takeIntent('new:vulns') ? 'new' : null));
  // Drill-through from the dashboard/calendar lands here with a record id.
  const [selectedId, setSelectedId] = useState<string | null>(() => takeOpenIntent('vulns'));
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

  const selectSev = (key: string) => { const s = key.slice(4) as VulnSeverity; filter.select(key, s, (v) => v.severity === s && isOpenVuln(v)); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  // Signature widget: SLA runway — each open vuln plotted against today.
  // Left of the centre line = days past the SLA; right = days of runway left.
  const runway = open
    .map((v) => ({ v, left: slaDaysLeft(v) ?? 0 }))
    .sort((a, b) => a.left - b.left)
    .slice(0, 8);
  const runwayCap = Math.max(14, ...runway.map((r) => Math.min(60, Math.abs(r.left))));

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vulns;
    return vulns.filter((v) => [v.id, v.title, v.ref, v.asset, v.owner, v.source, v.severity, v.status].join(' ').toLowerCase().includes(s));
  }, [vulns, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);
  const selected = selectedId ? vulns.find((v) => v.id === selectedId) ?? null : null;

  const save = (v: Vuln) => { setVulns(vulnRepo.save(v)); setEditing(null); ui.toast('Vulnerability saved', 'bg-green-700'); };
  const del = (v: Vuln) => ui.confirm(`Delete "${v.id}"?`, 'You can undo this immediately afterwards.', () => { setVulns(vulnRepo.remove(v.id)); ui.toast('Vulnerability deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setVulns(vulnRepo.save(v)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample vulnerabilities and discards your changes.', () => { setVulns(vulnRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
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
      <ChartGrid sortKey="vulns-charts">
        <ChartPanel title="Open by severity" span={4} filterLabel={chipFor('sev:')} onClearFilter={filter.clear}>
          <DonutChart segments={sevSeg} center={String(open.length)} sub="open" activeKey={filter.activeKey} onSelect={selectSev} />
        </ChartPanel>
        <ChartPanel title="SLA runway — most urgent first" span={8}>
          {runway.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No open vulnerabilities. 🎉</div>
          ) : (
            <div className="space-y-2.5">
              {runway.map(({ v, left }) => {
                const pct = (Math.min(60, Math.abs(left)) / runwayCap) * 50;
                const tone = left < 0 ? 'crit' : left <= 7 ? 'med' : 'low';
                return (
                  <div key={v.id} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-[11.5px]" title={`${v.id} — ${v.title}`} style={{ color: 'var(--text2)' }}>
                      <b className="font-mono" style={{ color: `var(--${severityTone[v.severity]})` }}>{v.id}</b> {v.title}
                    </span>
                    <span className="relative flex-1 h-4 rounded-md" style={{ background: 'var(--surface3)' }}>
                      <span className="absolute inset-y-0" style={{ left: '50%', width: 2, background: 'var(--text3)', opacity: 0.5 }} />
                      <span
                        className="absolute inset-y-0 rounded-sm"
                        style={left < 0
                          ? { right: '50%', width: `${pct}%`, background: 'var(--crit)' }
                          : { left: '50%', width: `${Math.max(pct, 2)}%`, background: `var(--${tone})` }}
                      />
                    </span>
                    <span className="w-16 text-right text-[11.5px] font-bold tabular-nums whitespace-nowrap" style={{ color: `var(--${tone})` }}>
                      {left < 0 ? `${-left}d over` : `${left}d left`}
                    </span>
                  </div>
                );
              })}
              <div className="text-[10.5px] text-center pt-1" style={{ color: 'var(--text3)' }}>◀ past SLA&ensp;·&ensp;│ today&ensp;·&ensp;runway remaining ▶</div>
            </div>
          )}
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vulnerabilities…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={vulnIo} exportSource={rows} existing={vulns} canImport={perms.create} canExport={perms.export} onImported={(items) => setVulns(vulnRepo.bulkSave(items))} />
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
                  <tr key={v.id} className="risk-row cursor-pointer" onClick={() => setSelectedId(v.id)}>
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

      {selected && (
        <RecordDrawer
          open
          onClose={() => setSelectedId(null)}
          title={`${selected.id} — ${selected.title}`}
          subtitle={`${selected.source}${selected.ref ? ` · ${selected.ref}` : ''}`}
          icon={<Icon name="alert" size={22} />}
          badges={
            <>
              <Pill text={selected.severity} k={severityTone[selected.severity]} />
              <Pill text={selected.status} k={statusTone[selected.status]} />
              {slaBreached(selected) && <Pill text={`SLA breached ${Math.abs(slaDaysLeft(selected) ?? 0)}d`} k="crit" />}
            </>
          }
          fields={[
            { label: 'Affected asset', value: selected.asset },
            { label: 'Reference / CVE', value: selected.ref },
            { label: 'CVSS', value: selected.cvss },
            { label: 'Discovered', value: selected.discovered },
            { label: 'SLA deadline', value: slaDeadline(selected) },
            {
              label: 'SLA position',
              value: !isOpenVuln(selected)
                ? selected.status
                : (() => {
                    const left = slaDaysLeft(selected);
                    if (left == null) return '—';
                    return left < 0 ? `${-left} days over` : `${left} days left`;
                  })(),
            },
            { label: 'Remediation owner', value: selected.owner },
            { label: 'Technical detail', value: selected.description, block: true },
            { label: 'Remediation plan', value: selected.remediation, block: true },
          ]}
          footer={
            perms.edit ? (
              <button
                onClick={() => { setSelectedId(null); setEditing(selected); }}
                className="bg-blue-600 text-white w-full rounded px-3 py-2 text-sm font-semibold"
              >
                Edit vulnerability
              </button>
            ) : undefined
          }
        />
      )}

      {editing && <VulnModal vuln={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
