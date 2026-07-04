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
  Sparkline,
  useChartFilter,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { downloadCsv } from '../../lib/csv';
import { today } from '../../domain/scoring';
import { kpiRepo } from './repo';
import { DIRECTIONS, attainment, parseHistory, rag, ragLabel, type Direction, type Kpi, type Rag } from './types';

const RAG_TONE: Record<Rag, Tone> = { low: 'low', med: 'med', crit: 'crit' };
const improving = (k: Kpi) => {
  const h = parseHistory(k.history);
  if (h.length < 2) return true;
  const up = h[h.length - 1] >= h[0];
  return k.direction === 'Higher is better' ? up : !up;
};

function KpiModal({ kpi, onClose, onSave }: { kpi: Kpi | 'new'; onClose: () => void; onSave: (k: Kpi) => void }) {
  const ui = useUi();
  const e = kpi === 'new' ? null : kpi;
  const [name, setName] = useState(e?.name ?? '');
  const [target, setTarget] = useState(String(e?.target ?? ''));
  const [current, setCurrent] = useState(String(e?.current ?? ''));
  const [unit, setUnit] = useState(e?.unit ?? '');
  const [direction, setDirection] = useState<Direction>(e?.direction ?? 'Higher is better');
  const [history, setHistory] = useState(e?.history ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a KPI name.', 'bg-orange-600'); return; }
    const t = Number(target), c = Number(current);
    if (!Number.isFinite(t) || !Number.isFinite(c)) { ui.toast('Target and current must be numbers.', 'bg-orange-600'); return; }
    onSave({ id: e ? e.id : kpiRepo.nextId(), name: name.trim(), target: t, current: c, unit: unit.trim(), direction, history: history.trim() });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit KPI — ${e.id}` : 'New KPI'} subtitle="Performance metric" maxWidth="max-w-xl">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Name *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Mean time to contain" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={lbl}>Current *</label><input value={current} onChange={(ev) => setCurrent(ev.target.value)} className={field} inputMode="decimal" /></div>
          <div><label className={lbl}>Target *</label><input value={target} onChange={(ev) => setTarget(ev.target.value)} className={field} inputMode="decimal" /></div>
          <div><label className={lbl}>Unit</label><input value={unit} onChange={(ev) => setUnit(ev.target.value)} className={field} placeholder="% / h / count" /></div>
          <div><label className={lbl}>Direction</label><select value={direction} onChange={(ev) => setDirection(ev.target.value as Direction)} className={field}>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select></div>
        </div>
        <div><label className={lbl}>Trend history (comma-separated, oldest → newest)</label><input value={history} onChange={(ev) => setHistory(ev.target.value)} className={field} placeholder="40, 35, 30, 26, 22, 19" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save KPI' : 'Create KPI'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function KpisPage() {
  const ui = useUi();
  const perms = usePermissions('kpis');
  const [kpis, setKpis] = useState<Kpi[]>(() => kpiRepo.list());
  const [editing, setEditing] = useState<Kpi | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Kpi>();

  const RAGS: { key: string; label: string; tone: Tone }[] = [
    { key: 'rag:low', label: 'On Track', tone: 'low' },
    { key: 'rag:med', label: 'At Risk', tone: 'med' },
    { key: 'rag:crit', label: 'Off Track', tone: 'crit' },
  ];
  const ragSeg: DonutSegment[] = RAGS.map((r) => ({ key: r.key, label: r.label, tone: r.tone, value: kpis.filter((k) => rag(k) === r.key.slice(4)).length }));
  const selectRag = (key: string) => { const token = key.slice(4) as Rag; const r = RAGS.find((x) => x.key === key); if (r) filter.select(key, r.label, (k) => rag(k) === token); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return kpis;
    return kpis.filter((k) => [k.id, k.name, k.direction, k.unit].join(' ').toLowerCase().includes(s));
  }, [kpis, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (k: Kpi) => { setKpis(kpiRepo.save(k)); setEditing(null); ui.toast('KPI saved', 'bg-green-700'); };
  const del = (k: Kpi) => ui.confirm(`Delete "${k.name}"?`, 'This cannot be undone.', () => { setKpis(kpiRepo.remove(k.id)); ui.toast('KPI deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample KPIs and discards your changes.', () => { setKpis(kpiRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const exportCsv = () => downloadCsv(
    `kpis-${today}.csv`,
    ['ID', 'Name', 'Target', 'Current', 'Unit', 'Direction', 'RAG', 'History'],
    rows.map((k) => [k.id, k.name, k.target, k.current, k.unit, k.direction, ragLabel(rag(k)), k.history]),
  );

  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'KPIs tracked', v: kpis.length },
    { l: 'On track', v: kpis.filter((k) => rag(k) === 'low').length, t: 'low' },
    { l: 'At risk', v: kpis.filter((k) => rag(k) === 'med').length, t: 'med' },
    { l: 'Off track', v: kpis.filter((k) => rag(k) === 'crit').length, t: 'crit' },
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
        <ChartPanel title="RAG overview" span={4} filterLabel={chipFor('rag:')} onClearFilter={filter.clear}>
          <DonutChart segments={ragSeg} center={String(kpis.length)} sub="KPIs" activeKey={filter.activeKey} onSelect={selectRag} />
        </ChartPanel>
        <ChartPanel title="Scorecard" span={8}>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
            {kpis.map((k) => {
              const r = rag(k);
              const tone = RAG_TONE[r];
              const att = attainment(k);
              const up = improving(k);
              return (
                <div key={k.id} className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--surface2)' }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--text2)' }}>{k.name}</span>
                    <Pill text={ragLabel(r)} k={r} />
                  </div>
                  <div className="tabular-nums text-xl font-bold" style={{ color: 'var(--text)' }}>{k.current}<span className="text-[12px] font-medium" style={{ color: 'var(--text3)' }}> {k.unit}</span></div>
                  <div className="text-[10.5px] mt-0.5 mb-1.5" style={{ color: 'var(--text3)' }}>target {k.target}{k.unit} · {att}% attained {up ? '▲' : '▼'}</div>
                  <Sparkline values={parseHistory(k.history)} tone={tone} width={168} height={26} />
                </div>
              );
            })}
          </div>
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search KPIs…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        {perms.export && <button onClick={exportCsv} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New KPI</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">KPI</th>
                <th className="text-left px-4 py-3">Target</th>
                <th className="text-left px-4 py-3">Current</th>
                <th className="text-left px-4 py-3">RAG</th>
                <th className="text-left px-4 py-3">Trend</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No KPIs match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((k) => {
                const r = rag(k);
                const up = improving(k);
                return (
                  <tr key={k.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{k.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{k.direction}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text2)' }}>{k.target}{k.unit}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold whitespace-nowrap" style={{ color: 'var(--text)' }}>{k.current}{k.unit}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1"><span style={{ color: `var(--${RAG_TONE[r]})` }}>{up ? '▲' : '▼'}</span><Pill text={ragLabel(r)} k={r} /></span></td>
                    <td className="px-4 py-3"><Sparkline values={parseHistory(k.history)} tone={RAG_TONE[r]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        {perms.edit && <button onClick={() => setEditing(k)} className="text-blue-600 hover:underline">Edit</button>}
                        {perms.remove && <button onClick={() => del(k)} className="text-red-500 hover:underline">Delete</button>}
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

      {editing && <KpiModal kpi={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
