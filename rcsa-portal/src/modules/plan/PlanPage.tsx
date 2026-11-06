import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { StatStrip, type Stat } from '../../components/common/StatStrip';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useTableSort } from '../../components/common/useTableSort';
import { useUi } from '../../components/common/UiProvider';
import { allocateOrReport } from '../../data/ids';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { planIo } from './io';
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
import { planRepo } from './repo';
import { CATEGORIES, PRIORITIES, QUARTERS, priorityToken, type Initiative, type PlanCategory, type Priority, type Quarter } from './types';

const PRI_TONE = priorityToken as Record<Priority, Tone>;

function PlanModal({ item, onClose, onSave }: { item: Initiative | 'new'; onClose: () => void; onSave: (i: Initiative) => void }) {
  const ui = useUi();
  const e = item === 'new' ? null : item;
  const [initiative, setInitiative] = useState(e?.initiative ?? '');
  const [category, setCategory] = useState<PlanCategory>(e?.category ?? 'Security Operations');
  const [quarter, setQuarter] = useState<Quarter>(e?.quarter ?? 'Q1');
  const [owner, setOwner] = useState(e?.owner ?? '');
  const [priority, setPriority] = useState<Priority>(e?.priority ?? 'Medium');
  const [progress, setProgress] = useState(String(e?.progress ?? '0'));

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!initiative.trim()) { ui.toast('Enter an initiative name.', 'bg-orange-600'); return; }
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    const id = e ? e.id : allocateOrReport(() => planRepo.nextId(), (m) => ui.toast(m, 'bg-orange-600'));
    if (!id) return; // allocation failed: nothing saved, form stays open
    onSave({ id, initiative: initiative.trim(), category, quarter, owner: owner.trim(), priority, progress: p });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Initiative — ${e.id}` : 'New Initiative'} subtitle="Annual roadmap item" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6 space-y-4">
        <label className="block"><span className={lbl}>Initiative *</span><input value={initiative} maxLength={200} onChange={(ev) => setInitiative(ev.target.value)} className={field} placeholder="e.g. SIEM detection engineering uplift" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block"><span className={lbl}>Category</span><select value={category} onChange={(ev) => setCategory(ev.target.value as PlanCategory)} className={field}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="block"><span className={lbl}>Owner</span><input value={owner} maxLength={120} onChange={(ev) => setOwner(ev.target.value)} className={field} placeholder="Owner / team" /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block"><span className={lbl}>Quarter</span><select value={quarter} onChange={(ev) => setQuarter(ev.target.value as Quarter)} className={field}>{QUARTERS.map((qr) => <option key={qr}>{qr}</option>)}</select></label>
          <label className="block"><span className={lbl}>Priority</span><select value={priority} onChange={(ev) => setPriority(ev.target.value as Priority)} className={field}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label className="block"><span className={lbl}>Progress %</span><input value={progress} onChange={(ev) => setProgress(ev.target.value)} className={field} inputMode="numeric" /></label>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Initiative' : 'Create Initiative'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function PlanPage() {
  const ui = useUi();
  const perms = usePermissions('yearly-plan');
  const [items, setItems] = useState<Initiative[]>(() => planRepo.list());
  const [editing, setEditing] = useState<Initiative | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Initiative>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.plan.v2') setItems(planRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const prioritySeg: DonutSegment[] = PRIORITIES.map((p) => ({ key: `pri:${p}`, label: p, tone: PRI_TONE[p], value: items.filter((i) => i.priority === p).length }));
  const quarterRows: BarRow[] = QUARTERS.map((qr) => ({ key: `q:${qr}`, label: qr, tone: 'info' as Tone, value: items.filter((i) => i.quarter === qr).length }));
  const categoriesPresent = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const categoryRows: BarRow[] = categoriesPresent.map((c) => {
    const set = items.filter((i) => i.category === c);
    const avg = set.length ? Math.round(set.reduce((s, i) => s + (Number(i.progress) || 0), 0) / set.length) : 0;
    return { key: `cat:${c}`, label: c, tone: (avg >= 70 ? 'low' : avg >= 35 ? 'med' : 'crit') as Tone, value: avg };
  });

  const selectPriority = (key: string) => { const p = key.slice(4) as Priority; filter.select(key, p, (i) => i.priority === p); };
  const selectQuarter = (key: string) => { const qr = key.slice(2) as Quarter; filter.select(key, qr, (i) => i.quarter === qr); };
  const selectCategory = (key: string) => { const c = key.slice(4) as PlanCategory; filter.select(key, c, (i) => i.category === c); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => [i.id, i.initiative, i.category, i.owner, i.quarter, i.priority].join(' ').toLowerCase().includes(s));
  }, [items, q]);
  // Sort runs after search + chart filter, so it composes with them.
  // Default: earliest quarter first.
  const { rows, sortable } = useTableSort(
    filter.apply(searched),
    {
      initiative: (i) => i.initiative,
      quarter: (i) => QUARTERS.indexOf(i.quarter),
      owner: (i) => i.owner,
      priority: (i) => PRIORITIES.indexOf(i.priority),
      progress: (i) => i.progress,
    },
    { key: 'quarter', dir: 'asc' },
    'text-left px-4 py-3',
  );
  const pager = usePaged(rows);

  const save = (i: Initiative) => { setItems(planRepo.save(i)); setEditing(null); ui.toast('Initiative saved', 'bg-green-700'); };
  const del = (i: Initiative) => ui.confirm(`Delete "${i.initiative}"?`, 'You can undo this immediately afterwards.', () => { setItems(planRepo.remove(i.id)); ui.toast('Initiative deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setItems(planRepo.save(i)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample initiatives and discards your changes.', () => { setItems(planRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
  const avgAll = items.length ? Math.round(items.reduce((s, i) => s + (Number(i.progress) || 0), 0) / items.length) : 0;
  const stats: Stat<Initiative>[] = [
    { l: 'Initiatives', v: items.length },
    { l: 'High priority', v: items.filter((i) => i.priority === 'High').length, t: 'crit', k: 'stat:high', pred: (i) => i.priority === 'High' },
    { l: 'Avg progress', v: `${avgAll}%`, t: 'ok' },
    { l: 'Completed', v: items.filter((i) => i.progress >= 100).length, t: 'low', k: 'stat:done', pred: (i) => i.progress >= 100 },
  ];

  return (
    <div className="p-6 space-y-4">
      <StatStrip stats={stats} filter={filter} />

      <ChartGrid sortKey="plan-charts" collapsible>
        <ChartPanel title="Priority mix" span={4} filterLabel={chipFor('pri:')} onClearFilter={filter.clear}>
          <DonutChart segments={prioritySeg} center={String(items.length)} sub="initiatives" activeKey={filter.activeKey} onSelect={selectPriority} />
        </ChartPanel>
        <ChartPanel title="Initiatives by quarter" span={4} filterLabel={chipFor('q:')} onClearFilter={filter.clear}>
          <HBarChart rows={quarterRows} activeKey={filter.activeKey} onSelect={selectQuarter} />
        </ChartPanel>
        <ChartPanel title="Avg progress by category" span={4} filterLabel={chipFor('cat:')} onClearFilter={filter.clear}>
          <HBarChart rows={categoryRows} max={100} suffix="%" activeKey={filter.activeKey} onSelect={selectCategory} />
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search initiatives…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--link)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={planIo} exportSource={rows} existing={items} canImport={perms.create} canExport={perms.export} onImported={(items) => setItems(planRepo.bulkSave(items))} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Initiative</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                {sortable('initiative', 'Initiative')}
                {sortable('quarter', 'Quarter')}
                {sortable('owner', 'Owner')}
                {sortable('priority', 'Priority')}
                {sortable('progress', 'Progress', '', { minWidth: 160 })}
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No initiatives match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((i) => (
                <tr key={i.id} className="risk-row">
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>{i.initiative}</div>
                    <div className="text-xs" style={{ color: 'var(--text3)' }}>{i.category}</div>
                  </td>
                  <td className="px-4 py-3"><Pill text={i.quarter} k="info" /></td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text2)' }}>{i.owner}</td>
                  <td className="px-4 py-3"><Pill text={i.priority} k={PRI_TONE[i.priority]} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded-full overflow-hidden" style={{ flex: 1, background: 'var(--surface3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${i.progress}%`, background: i.progress >= 100 ? 'var(--low)' : 'var(--accent)', minWidth: 3 }} />
                      </div>
                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{i.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {perms.edit || perms.remove ? <RowActions onEdit={perms.edit ? () => setEditing(i) : undefined} onDelete={perms.remove ? () => del(i) : undefined} editLabel="Edit initiative" deleteLabel="Delete initiative" /> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <PlanModal item={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
