import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/layout/Drawer';
import { Ring } from '../../components/charts/Ring';
import { Icon } from '../../components/common/Icon';
import { Pill } from '../../components/common/Pill';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { vendorRepo } from './repo';
import {
  CRITICALITIES,
  VENDOR_STATUSES,
  band,
  criticalityColor,
  daysLeft,
  type Criticality,
  type Vendor,
  type VendorStatus,
} from './types';

const today = () => new Date().toISOString().slice(0, 10);
const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function VendorModal({ vendor, onClose, onSave }: { vendor: Vendor | 'new'; onClose: () => void; onSave: (v: Vendor) => void }) {
  const ui = useUi();
  const e = vendor === 'new' ? null : vendor;
  const [name, setName] = useState(e?.name ?? '');
  const [category, setCategory] = useState(e?.category ?? '');
  const [criticality, setCriticality] = useState<Criticality>(e?.criticality ?? 'Medium');
  const [dataAccess, setDataAccess] = useState(e?.dataAccess ?? false);
  const [score, setScore] = useState(String(e?.score ?? ''));
  const [expiry, setExpiry] = useState(e?.expiry ?? '');
  const [status, setStatus] = useState<VendorStatus>(e?.status ?? 'Active');
  const [certs, setCerts] = useState((e?.certs ?? []).join(', '));
  const [sla, setSla] = useState(e?.sla ?? '');
  const [pentest, setPentest] = useState(e?.pentest ?? '');
  const [bcp, setBcp] = useState(e?.bcp ?? '');
  const [dataNote, setDataNote] = useState(e?.dataNote ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a vendor name.', 'bg-orange-600'); return; }
    const s = Number(score);
    if (!Number.isFinite(s) || s < 0 || s > 100) { ui.toast('Risk score must be 0–100.', 'bg-orange-600'); return; }
    onSave({
      id: e ? e.id : vendorRepo.nextId(),
      name: name.trim(),
      category: category.trim(),
      criticality,
      dataAccess,
      score: s,
      expiry,
      assessed: e?.assessed ?? today(),
      status,
      certs: certs.split(',').map((c) => c.trim()).filter(Boolean),
      sla: sla.trim(),
      pentest: pentest.trim(),
      bcp: bcp.trim(),
      dataNote: dataNote.trim(),
      history: e?.history ?? [{ date: today(), note: 'Vendor onboarded' }],
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Vendor — ${e.id}` : 'New Vendor'} subtitle="Third-party risk profile" maxWidth="max-w-xl">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Name *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="Vendor name" /></div>
          <div><label className={lbl}>Service / Category</label><input value={category} onChange={(ev) => setCategory(ev.target.value)} className={field} placeholder="e.g. Cloud Infrastructure" /></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>Criticality</label>
            <select value={criticality} onChange={(ev) => setCriticality(ev.target.value as Criticality)} className={field}>{CRITICALITIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className={lbl}>Data access</label>
            <select value={dataAccess ? 'Yes' : 'No'} onChange={(ev) => setDataAccess(ev.target.value === 'Yes')} className={field}><option>No</option><option>Yes</option></select>
          </div>
          <div><label className={lbl}>Risk score (0–100)</label><input value={score} onChange={(ev) => setScore(ev.target.value)} className={field} inputMode="numeric" /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as VendorStatus)} className={field}>{VENDOR_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Contract expiry</label><input type="date" value={expiry} onChange={(ev) => setExpiry(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Certifications (comma-separated)</label><input value={certs} onChange={(ev) => setCerts(ev.target.value)} className={field} placeholder="ISO 27001, SOC 2" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={lbl}>Incident SLA</label><input value={sla} onChange={(ev) => setSla(ev.target.value)} className={field} placeholder="e.g. 4 hrs" /></div>
          <div><label className={lbl}>Penetration test</label><input value={pentest} onChange={(ev) => setPentest(ev.target.value)} className={field} placeholder="e.g. Passed" /></div>
          <div><label className={lbl}>Business continuity</label><input value={bcp} onChange={(ev) => setBcp(ev.target.value)} className={field} placeholder="e.g. Tested" /></div>
        </div>
        <div><label className={lbl}>Data handling</label><textarea value={dataNote} onChange={(ev) => setDataNote(ev.target.value)} className={field} rows={2} placeholder="What data does this vendor access / store?" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Vendor</button>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Vendor | 'new' | null>(null);

  const selected = vendors.find((v) => v.id === selectedId) ?? null;

  const renewals = useMemo(
    () => vendors.filter((v) => v.status === 'Active' && daysLeft(v.expiry) >= 0 && daysLeft(v.expiry) <= 120).sort((a, b) => daysLeft(a.expiry) - daysLeft(b.expiry)),
    [vendors],
  );
  const chips = useMemo(() => {
    const crit = vendors.filter((v) => v.criticality === 'Critical' && v.status === 'Active').length;
    const avg = vendors.length ? Math.round(vendors.reduce((s, v) => s + v.score, 0) / vendors.length) : 0;
    return [
      { label: 'Total Vendors', value: vendors.length, color: 'var(--text)' },
      { label: 'Critical', value: crit, color: 'var(--crit)' },
      { label: 'Renewals < 120d', value: renewals.length, color: 'var(--high)' },
      { label: 'Avg Risk Score', value: avg, color: 'var(--accent)' },
    ];
  }, [vendors, renewals]);

  const save = (v: Vendor) => { setVendors(vendorRepo.save(v)); setEditing(null); ui.toast('Vendor saved', 'bg-green-700'); };
  const del = (v: Vendor) => ui.confirm(`Delete "${v.name}"?`, 'This cannot be undone.', () => { setVendors(vendorRepo.remove(v.id)); setSelectedId(null); ui.toast('Vendor deleted', 'bg-red-700'); });
  const reassess = (v: Vendor) => {
    const updated: Vendor = { ...v, assessed: today(), history: [{ date: today(), note: 'Reassessment completed' }, ...v.history] };
    setVendors(vendorRepo.save(updated));
    ui.toast('Reassessment recorded', 'bg-green-700');
  };

  const fieldRow = (label: string, value: string, alt = false) => (
    <div className="flex justify-between gap-3 px-3 py-2.5" style={{ background: alt ? 'var(--surface2)' : undefined }}>
      <span className="text-[12.5px]" style={{ color: 'var(--text3)' }}>{label}</span>
      <span className="text-[12.5px] font-semibold text-right" style={{ color: 'var(--text)' }}>{value || '—'}</span>
    </div>
  );

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Vendor</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample vendors and discards your changes.', () => { setVendors(vendorRepo.reset()); setSelectedId(null); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Chips */}
        <div className="flex gap-3 flex-wrap">
          {chips.map((c) => (
            <div key={c.label} className="section-card px-4 py-3 flex-1 min-w-[150px]">
              <div className="text-[11px] mb-1" style={{ color: 'var(--text3)' }}>{c.label}</div>
              <div className="text-xl font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Renewal banner */}
        {renewals.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: 'var(--high-bg)', border: '1px solid var(--high)' }}>
            <div className="flex items-center gap-2 text-[13px] font-bold mb-2.5" style={{ color: 'var(--high)' }}>
              <Icon name="clock" size={16} /> Upcoming contract renewals
            </div>
            <div className="flex gap-2.5 flex-wrap">
              {renewals.map((v) => (
                <button key={v.id} onClick={() => setSelectedId(v.id)} className="section-card flex items-center gap-2.5 px-3 py-2 text-left">
                  <div>
                    <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{v.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text3)' }}>Expires {v.expiry}</div>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--high-bg)', color: 'var(--high)' }}>{daysLeft(v.expiry)}d</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Registry */}
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">Vendor Registry</h2>
            <span className="text-xs text-gray-500">{vendors.length} vendors</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Vendor</th>
                  <th className={th}>Service</th>
                  <th className={th}>Criticality</th>
                  <th className={`${th} text-center`}>Data</th>
                  <th className={th}>Risk Score</th>
                  <th className={th}>Contract Expiry</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vendors.map((v) => {
                  const b = band(v.score);
                  const dl = daysLeft(v.expiry);
                  return (
                    <tr key={v.id} className="risk-row" onClick={() => setSelectedId(v.id)}>
                      <td className="px-4 py-3 font-semibold text-gray-800">{v.name}</td>
                      <td className="px-4 py-3 text-gray-500">{v.category}</td>
                      <td className="px-4 py-3"><Pill text={v.criticality} k={criticalityColor(v.criticality)} /></td>
                      <td className="px-4 py-3 text-center text-xs" style={{ color: v.dataAccess ? 'var(--text2)' : 'var(--text3)' }}>{v.dataAccess ? '✓' : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-bold" style={{ color: `var(--${b.k})` }}>
                          {v.score}
                          <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `var(--${b.k}-bg)` }}>{b.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: dl < 0 ? 'var(--crit)' : dl <= 120 ? 'var(--high)' : 'var(--text2)' }}>
                        {v.expiry}{dl < 0 ? ' · expired' : dl <= 120 ? ` · ${dl}d` : ''}
                      </td>
                      <td className="px-4 py-3"><Pill text={v.status} k={v.status === 'Active' ? 'low' : 'mut'} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <Drawer
          open
          onClose={() => setSelectedId(null)}
          title={selected.name}
          subtitle={`${selected.category} · ${selected.id}`}
          icon={<Icon name="building" size={22} />}
          footer={
            perms.edit ? (
              <div className="flex gap-3">
                <button onClick={() => setEditing(selected)} className="btn-neutral flex-1 border rounded px-3 py-2 text-sm">Edit</button>
                <button onClick={() => reassess(selected)} className="bg-blue-600 text-white flex-1 rounded px-3 py-2 text-sm font-semibold">Launch reassessment</button>
              </div>
            ) : undefined
          }
        >
          <div className="space-y-6">
            <div className="flex items-center gap-5">
              <Ring pct={selected.score} size={104} stroke={12} color={`var(--${band(selected.score).k})`} />
              <div className="space-y-2.5">
                <div>
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text3)' }}>Risk Rating</div>
                  <Pill text={band(selected.score).label} k={band(selected.score).k} />
                </div>
                <div>
                  <div className="text-[11px] mb-1" style={{ color: 'var(--text3)' }}>Criticality</div>
                  <Pill text={selected.criticality} k={criticalityColor(selected.criticality)} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text3)' }}>Security Assessment</div>
              <div className="rounded-[10px] overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {fieldRow('Data access', selected.dataNote, true)}
                {fieldRow('Incident SLA', selected.sla)}
                {fieldRow('Penetration test', selected.pentest, true)}
                {fieldRow('Business continuity', selected.bcp)}
                {fieldRow('Contract expiry', selected.expiry, true)}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text3)' }}>Certifications</div>
              {selected.certs.length === 0 ? (
                <div className="text-[12.5px] flex items-center gap-1.5" style={{ color: 'var(--crit)' }}>
                  <Icon name="alert" size={14} /> No certifications on file
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {selected.certs.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                      <Icon name="check" size={13} />{c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'var(--text3)' }}>Assessment History</div>
              <div className="space-y-3">
                {selected.history.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: 'var(--accent)', boxShadow: '0 0 0 3px var(--accent-soft)' }} />
                    <div>
                      <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{h.note}</div>
                      <div className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--text3)' }}>{h.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {perms.remove && <button onClick={() => del(selected)} className="text-red-500 text-xs hover:underline">Delete vendor</button>}
          </div>
        </Drawer>
      )}

      {editing && <VendorModal vendor={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
