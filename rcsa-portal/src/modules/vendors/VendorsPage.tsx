import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { vendorIo } from './io';
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
import { today, todayPlus } from '../../domain/scoring';
import { vendorRepo } from './repo';
import {
  CERT_OPTIONS,
  CRITICALITIES,
  DATA_ACCESS,
  criticalityToken,
  scoreBand,
  type Criticality,
  type DataAccess,
  type Vendor,
} from './types';

const iso = todayPlus;
const CRIT_TONE = criticalityToken as Record<Criticality, Tone>;

// ── Add / edit modal ──────────────────────────────────────────────────────────
function VendorModal({ vendor, onClose, onSave }: { vendor: Vendor | 'new'; onClose: () => void; onSave: (v: Vendor) => void }) {
  const ui = useUi();
  const e = vendor === 'new' ? null : vendor;
  const [name, setName] = useState(e?.name ?? '');
  const [criticality, setCriticality] = useState<Criticality>(e?.criticality ?? 'Medium');
  const [dataAccess, setDataAccess] = useState<DataAccess>(e?.dataAccess ?? 'Internal');
  const [score, setScore] = useState(String(e?.score ?? ''));
  const [contractExpiry, setContractExpiry] = useState(e?.contractExpiry ?? '');
  const [certs, setCerts] = useState<string[]>(e?.certs ?? []);

  const toggleCert = (c: string) => setCerts((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a vendor name.', 'bg-orange-600'); return; }
    const s = Number(score);
    if (!Number.isFinite(s) || s < 0 || s > 100) { ui.toast('Residual score must be 0–100.', 'bg-orange-600'); return; }
    onSave({ id: e ? e.id : vendorRepo.nextId(), name: name.trim(), criticality, dataAccess, score: s, contractExpiry, certs });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Vendor — ${e.id}` : 'New Vendor'} subtitle="Third-party vendor" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Vendor name *</label><input value={name} maxLength={200} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. CardFlow Processing" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Criticality</label><select value={criticality} onChange={(ev) => setCriticality(ev.target.value as Criticality)} className={field}>{CRITICALITIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={lbl}>Data access</label><select value={dataAccess} onChange={(ev) => setDataAccess(ev.target.value as DataAccess)} className={field}>{DATA_ACCESS.map((d) => <option key={d}>{d}</option>)}</select></div>
          <div><label className={lbl}>Residual score (0–100, lower is better)</label><input value={score} onChange={(ev) => setScore(ev.target.value)} className={field} inputMode="numeric" placeholder="0–100" /></div>
          <div><label className={lbl}>Contract expiry</label><input type="date" value={contractExpiry} onChange={(ev) => setContractExpiry(ev.target.value)} className={field} /></div>
        </div>
        <div>
          <label className={lbl}>Certifications</label>
          <div className="flex flex-wrap gap-2">
            {CERT_OPTIONS.map((c) => {
              const on = certs.includes(c);
              return (
                <button type="button" key={c} onClick={() => toggleCert(c)} className="text-xs font-medium px-3 py-1.5 rounded-lg border"
                  style={{ background: on ? 'var(--ok-bg)' : 'var(--surface2)', borderColor: on ? 'var(--accent)' : 'var(--border)', color: on ? 'var(--accent)' : 'var(--text2)' }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Vendor' : 'Create Vendor'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function VendorsPage() {
  const ui = useUi();
  const perms = usePermissions('vendors');
  const [vendors, setVendors] = useState<Vendor[]>(() => vendorRepo.list());
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Vendor>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.vendors.v2') setVendors(vendorRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const in60 = iso(60), in180 = iso(180);

  const RENEWALS = [
    { key: 'ren:Expired', label: 'Expired', tone: 'crit' as Tone, pred: (v: Vendor) => v.contractExpiry < today() },
    { key: 'ren:60', label: '≤60 days', tone: 'med' as Tone, pred: (v: Vendor) => v.contractExpiry >= today() && v.contractExpiry < in60 },
    { key: 'ren:180', label: '≤180 days', tone: 'info' as Tone, pred: (v: Vendor) => v.contractExpiry >= in60 && v.contractExpiry < in180 },
    { key: 'ren:later', label: 'Later', tone: 'low' as Tone, pred: (v: Vendor) => v.contractExpiry >= in180 },
  ];

  const critSeg: DonutSegment[] = CRITICALITIES.map((c) => ({ key: `crit:${c}`, label: c, tone: CRIT_TONE[c], value: vendors.filter((v) => v.criticality === c).length }));
  const renewRows: BarRow[] = RENEWALS.map((r) => ({ key: r.key, label: r.label, tone: r.tone, value: vendors.filter(r.pred).length }));

  const selectCrit = (key: string) => { const c = key.slice(5) as Criticality; filter.select(key, c, (v) => v.criticality === c); };
  const selectRenew = (key: string) => { const r = RENEWALS.find((x) => x.key === key); if (r) filter.select(r.key, r.label, r.pred); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  // Signature widget: risk position matrix — criticality × residual-score band.
  // Top-left (Critical × Severe) is the fire corner; each cell click-filters.
  const BAND_ORDER = ['Severe', 'Elevated', 'Moderate', 'Healthy'] as const;
  const BAND_TONE: Record<string, string> = { Severe: 'crit', Elevated: 'high', Moderate: 'med', Healthy: 'low' };
  const inCell = (c: Criticality, b: string) => (v: Vendor) => v.criticality === c && scoreBand(v.score).label === b;

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return vendors;
    return vendors.filter((v) => [v.id, v.name, v.criticality, v.dataAccess, v.certs.join(' ')].join(' ').toLowerCase().includes(s));
  }, [vendors, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (v: Vendor) => { setVendors(vendorRepo.save(v)); setEditing(null); ui.toast('Vendor saved', 'bg-green-700'); };
  const del = (v: Vendor) => ui.confirm(`Delete "${v.name}"?`, 'This cannot be undone.', () => { setVendors(vendorRepo.remove(v.id)); ui.toast('Vendor deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample vendors and discards your changes.', () => { setVendors(vendorRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'Vendors', v: vendors.length },
    { l: 'Critical', v: vendors.filter((v) => v.criticality === 'Critical').length, t: 'crit' },
    { l: 'High risk score (≥60)', v: vendors.filter((v) => v.score >= 60).length, t: 'high' },
    { l: 'Renewals ≤60 days', v: vendors.filter((v) => v.contractExpiry < in60).length, t: 'med' },
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
        <ChartPanel title="Vendor criticality" span={4} filterLabel={chipFor('crit:')} onClearFilter={filter.clear}>
          <DonutChart segments={critSeg} center={String(vendors.length)} sub="vendors" activeKey={filter.activeKey} onSelect={selectCrit} />
        </ChartPanel>
        <ChartPanel title="Risk position matrix" span={4} filterLabel={chipFor('mx:')} onClearFilter={filter.clear}>
          <div>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(4, 1fr)' }}>
              <div />
              {BAND_ORDER.map((b) => (
                <div key={b} className="text-center text-[9.5px] font-bold uppercase tracking-wide pb-0.5" style={{ color: `var(--${BAND_TONE[b]})` }}>{b}</div>
              ))}
              {CRITICALITIES.map((c) => (
                <div key={c} className="contents">
                  <div className="flex items-center justify-end pr-1.5 text-[11px] whitespace-nowrap" style={{ color: 'var(--text2)' }}>{c}</div>
                  {BAND_ORDER.map((b) => {
                    const pred = inCell(c, b);
                    const n = vendors.filter(pred).length;
                    const key = `mx:${c}|${b}`;
                    const active = filter.activeKey === key;
                    return (
                      <button
                        key={b}
                        onClick={() => filter.select(key, `${c} · ${b}`, pred)}
                        title={`${c} criticality · ${b} score: ${n} vendor${n === 1 ? '' : 's'}`}
                        className="rounded-md py-2 text-[13px] font-bold tabular-nums transition-transform hover:scale-105"
                        style={{
                          background: n > 0 ? `var(--${BAND_TONE[b]})` : 'var(--surface3)',
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
            <div className="text-[10.5px] mt-2 text-center" style={{ color: 'var(--text3)' }}>Criticality × residual score · click a cell to filter</div>
          </div>
        </ChartPanel>
        <ChartPanel title="Contract renewals" span={4} filterLabel={chipFor('ren:')} onClearFilter={filter.clear}>
          <HBarChart rows={renewRows} activeKey={filter.activeKey} onSelect={selectRenew} />
        </ChartPanel>
      </ChartGrid>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={vendorIo} exportSource={rows} existing={vendors} canImport={perms.create} canExport={perms.export} onImported={(items) => setVendors(vendorRepo.bulkSave(items))} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Vendor</button>}
      </div>

      {/* Table */}
      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">Vendor</th>
                <th className="text-left px-4 py-3">Criticality</th>
                <th className="text-left px-4 py-3">Risk score</th>
                <th className="text-left px-4 py-3">Contract</th>
                <th className="text-left px-4 py-3">Certifications</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No vendors match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((v) => {
                const band = scoreBand(v.score);
                const expired = v.contractExpiry < today();
                const soon = !expired && v.contractExpiry < in60;
                return (
                  <tr key={v.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{v.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>data access: {v.dataAccess}</div>
                    </td>
                    <td className="px-4 py-3"><Pill text={v.criticality} k={CRIT_TONE[v.criticality]} /></td>
                    <td className="px-4 py-3"><Pill text={`${v.score} / 100`} k={band.k} /></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {expired ? <Pill text={`Expired · ${v.contractExpiry}`} k="crit" /> : soon ? <Pill text={`Renews · ${v.contractExpiry}`} k="med" /> : <span style={{ color: 'var(--text2)' }}>{v.contractExpiry}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.certs.length ? (
                        <span className="flex flex-wrap gap-1">
                          {v.certs.map((c) => <span key={c} className="text-[10.5px] px-2 py-0.5 rounded-full" style={{ background: 'var(--surface3)', color: 'var(--text3)' }}>{c}</span>)}
                        </span>
                      ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions onEdit={perms.edit ? () => setEditing(v) : undefined} onDelete={perms.remove ? () => del(v) : undefined} editLabel="Edit vendor" deleteLabel="Delete vendor" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <VendorModal vendor={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
