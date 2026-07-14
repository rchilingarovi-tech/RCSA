import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { policyIo } from './io';
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
import { policyRepo } from './repo';
import { DOC_STATUSES, DOC_TYPES, statusToken, typeToken, type DocStatus, type DocType, type PolicyDoc } from './types';

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const STATUS_TONE = statusToken as Record<DocStatus, Tone>;
const TYPE_TONE = typeToken as Record<DocType, Tone>;

function PolicyModal({ doc, onClose, onSave }: { doc: PolicyDoc | 'new'; onClose: () => void; onSave: (d: PolicyDoc) => void }) {
  const ui = useUi();
  const e = doc === 'new' ? null : doc;
  const [title, setTitle] = useState(e?.title ?? '');
  const [type, setType] = useState<DocType>(e?.type ?? 'Policy');
  const [version, setVersion] = useState(e?.version ?? '1.0');
  const [status, setStatus] = useState<DocStatus>(e?.status ?? 'Draft');
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [nextReview, setNextReview] = useState(e?.nextReview ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a document title.', 'bg-orange-600'); return; }
    onSave({ id: e ? e.id : policyRepo.nextId(), title: title.trim(), type, version: version.trim(), status, owner: owner.trim(), nextReview });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Document — ${e.id}` : 'New Document'} subtitle="Policy / document record" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. Access Control Standard" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={lbl}>Type</label><select value={type} onChange={(ev) => setType(ev.target.value as DocType)} className={field}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Version</label><input value={version} onChange={(ev) => setVersion(ev.target.value)} className={field} placeholder="1.0" /></div>
          <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as DocStatus)} className={field}>{DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Next review</label><input type="date" value={nextReview} onChange={(ev) => setNextReview(ev.target.value)} className={field} /></div>
        </div>
        <div><label className={lbl}>Owner</label><input value={owner} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Owner / team" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Document' : 'Create Document'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function PoliciesPage() {
  const ui = useUi();
  const perms = usePermissions('policies');
  const [docs, setDocs] = useState<PolicyDoc[]>(() => policyRepo.list());
  const [editing, setEditing] = useState<PolicyDoc | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<PolicyDoc>();

  const in30 = iso(30);
  const CADENCE = [
    { key: 'cad:Overdue', label: 'Overdue', tone: 'crit' as Tone, pred: (d: PolicyDoc) => d.status !== 'Retired' && !!d.nextReview && d.nextReview < today() },
    { key: 'cad:Due', label: 'Due ≤30 days', tone: 'med' as Tone, pred: (d: PolicyDoc) => d.status !== 'Retired' && !!d.nextReview && d.nextReview >= today() && d.nextReview < in30 },
    { key: 'cad:Scheduled', label: 'Scheduled', tone: 'low' as Tone, pred: (d: PolicyDoc) => !!d.nextReview && d.nextReview >= in30 },
    { key: 'cad:None', label: 'No date', tone: 'mut' as Tone, pred: (d: PolicyDoc) => !d.nextReview },
  ];

  const statusSeg: DonutSegment[] = DOC_STATUSES.map((s) => ({ key: `st:${s}`, label: s, tone: STATUS_TONE[s], value: docs.filter((d) => d.status === s).length }));
  const typeRows: BarRow[] = DOC_TYPES.map((t) => ({ key: `ty:${t}`, label: t, tone: TYPE_TONE[t], value: docs.filter((d) => d.type === t).length }));

  // Signature widget: review timeline — a proportional cadence strip plus the
  // next reviews coming up, so the review calendar reads at a glance.
  const nextReviews = docs
    .filter((d) => d.status !== 'Retired' && d.nextReview)
    .sort((a, b) => (a.nextReview < b.nextReview ? -1 : 1))
    .slice(0, 4);

  const selectStatus = (key: string) => { const s = key.slice(3) as DocStatus; filter.select(key, s, (d) => d.status === s); };
  const selectType = (key: string) => { const t = key.slice(3) as DocType; filter.select(key, t, (d) => d.type === t); };
  const selectCadence = (key: string) => { const c = CADENCE.find((x) => x.key === key); if (c) filter.select(c.key, c.label, c.pred); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d) => [d.id, d.title, d.type, d.status, d.owner, d.version].join(' ').toLowerCase().includes(s));
  }, [docs, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (d: PolicyDoc) => { setDocs(policyRepo.save(d)); setEditing(null); ui.toast('Document saved', 'bg-green-700'); };
  const del = (d: PolicyDoc) => ui.confirm(`Delete "${d.title}"?`, 'This cannot be undone.', () => { setDocs(policyRepo.remove(d.id)); ui.toast('Document deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample documents and discards your changes.', () => { setDocs(policyRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'Documents', v: docs.length },
    { l: 'Approved', v: docs.filter((d) => d.status === 'Approved').length, t: 'low' },
    { l: 'Reviews due ≤30d', v: docs.filter(CADENCE[1].pred).length, t: 'med' },
    { l: 'Reviews overdue', v: docs.filter(CADENCE[0].pred).length, t: 'crit' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
        {stats.map((s) => (
          <div key={s.l} className="section-card p-4">
            <div className="tabular-nums text-2xl font-bold" style={{ color: s.t ? `var(--${s.t})` : 'var(--text)' }}>{s.v}</div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--text3)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      <ChartGrid>
        <ChartPanel title="Document status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <DonutChart segments={statusSeg} center={String(docs.length)} sub="documents" activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
        <ChartPanel title="By type" span={4} filterLabel={chipFor('ty:')} onClearFilter={filter.clear}>
          <HBarChart rows={typeRows} activeKey={filter.activeKey} onSelect={selectType} />
        </ChartPanel>
        <ChartPanel title="Review timeline" span={4} filterLabel={chipFor('cad:')} onClearFilter={filter.clear}>
          <div>
            {/* Proportional cadence strip — click a segment to filter */}
            <div className="flex h-7 rounded-lg overflow-hidden" style={{ background: 'var(--surface3)' }}>
              {CADENCE.map((c) => {
                const n = docs.filter(c.pred).length;
                if (n === 0) return null;
                const active = filter.activeKey === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => selectCadence(c.key)}
                    title={`${c.label}: ${n} document${n === 1 ? '' : 's'}`}
                    className="h-full flex items-center justify-center text-[11px] font-bold text-white transition-all hover:brightness-95"
                    style={{ width: `${(n / Math.max(1, docs.length)) * 100}%`, background: `var(--${c.tone})`, outline: active ? '2px solid var(--accent)' : 'none', outlineOffset: -2, minWidth: 26 }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {CADENCE.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--text3)' }}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--${c.tone})` }} />{c.label}
                </span>
              ))}
            </div>
            {/* Next reviews coming up */}
            <div className="mt-3 pt-2 border-t space-y-1.5" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>Next reviews</div>
              {nextReviews.length === 0 ? (
                <div className="text-[12px]" style={{ color: 'var(--text3)' }}>No reviews scheduled.</div>
              ) : nextReviews.map((d) => {
                const late = d.nextReview < today();
                const soon = !late && d.nextReview < in30;
                const k = late ? 'crit' : soon ? 'med' : 'low';
                return (
                  <div key={d.id} className="flex items-center gap-2 text-[12px]">
                    <span className="flex-1 truncate" title={d.title} style={{ color: 'var(--text2)' }}>{d.title}</span>
                    <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: `var(--${k}-bg)`, color: `var(--${k})` }}>{d.nextReview}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={policyIo} exportSource={rows} existing={docs} canImport={perms.create} canExport={perms.export} onImported={(items) => setDocs(policyRepo.bulkSave(items))} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Document</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">Document</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Review</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No documents match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((d) => {
                const overdue = d.status !== 'Retired' && !!d.nextReview && d.nextReview < today();
                const due = !overdue && !!d.nextReview && d.nextReview < in30 && d.status !== 'Retired';
                return (
                  <tr key={d.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{d.title}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>v{d.version} · {d.owner}</div>
                    </td>
                    <td className="px-4 py-3"><Pill text={d.type} k={TYPE_TONE[d.type]} /></td>
                    <td className="px-4 py-3"><Pill text={d.status} k={STATUS_TONE[d.status]} /></td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {!d.nextReview ? '—' : overdue ? <Pill text={`Overdue · ${d.nextReview}`} k="crit" /> : due ? <Pill text={`Due · ${d.nextReview}`} k="med" /> : <span style={{ color: 'var(--text2)' }}>{d.nextReview}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <RowActions onEdit={perms.edit ? () => setEditing(d) : undefined} onDelete={perms.remove ? () => del(d) : undefined} editLabel="Edit document" deleteLabel="Delete document" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <PolicyModal doc={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
