import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { kpiIo } from './io';
import {
  ChartGrid,
  ChartPanel,
  Sparkline,
  useChartFilter,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
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

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

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
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit KPI — ${e.id}` : 'New KPI'} subtitle="Performance metric" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6 space-y-4">
        <label className="block"><span className={lbl}>Name *</span><input value={name} maxLength={200} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Mean time to contain" /></label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="block"><span className={lbl}>Current *</span><input value={current} onChange={(ev) => setCurrent(ev.target.value)} className={field} inputMode="decimal" /></label>
          <label className="block"><span className={lbl}>Target *</span><input value={target} onChange={(ev) => setTarget(ev.target.value)} className={field} inputMode="decimal" /></label>
          <label className="block"><span className={lbl}>Unit</span><input value={unit} maxLength={12} onChange={(ev) => setUnit(ev.target.value)} className={field} placeholder="% / h / count" /></label>
          <label className="block"><span className={lbl}>Direction</span><select value={direction} onChange={(ev) => setDirection(ev.target.value as Direction)} className={field}>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select></label>
        </div>
        <label className="block"><span className={lbl}>Trend history (comma-separated, oldest → newest)</span><input value={history} maxLength={400} onChange={(ev) => setHistory(ev.target.value)} className={field} placeholder="40, 35, 30, 26, 22, 19" /></label>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save KPI' : 'Create KPI'}</button>
        </div>
      </form>
    </Modal>
  );
}

// RAG overview — a space-filling status visual (stacked health bar + progress
// meters) that reads better than a small donut in this tall card. Click a row to
// filter, exactly like the donut segments did.
function RagOverview({ segments, total, activeKey, onSelect }: { segments: DonutSegment[]; total: number; activeKey: string | null; onSelect: (key: string) => void }) {
  const onTrack = segments.find((s) => s.key === 'rag:low')?.value ?? 0;
  const pct = total ? Math.round((onTrack / total) * 100) : 0;
  const pctTone = pct >= 70 ? 'low' : pct >= 40 ? 'med' : 'crit';
  const pctOf = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[34px] font-bold tabular-nums leading-none" style={{ color: 'var(--text)' }}>{total}</div>
          <div className="text-[12px] mt-1" style={{ color: 'var(--text3)' }}>KPIs tracked</div>
        </div>
        <div className="text-right">
          <div className="text-[24px] font-bold tabular-nums leading-none" style={{ color: `var(--${pctTone})` }}>{pct}%</div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text3)' }}>on track</div>
        </div>
      </div>

      {/* Stacked health bar */}
      <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'var(--surface3)' }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <span key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${pctOf(s.value)}%`, background: `var(--${s.tone})` }} />
        ))}
      </div>

      {/* Progress meters — spread to fill the card height */}
      <div className="flex-1 flex flex-col justify-center gap-3.5">
        {segments.map((s) => {
          const p = pctOf(s.value);
          const active = activeKey === s.key;
          return (
            <button key={s.key} onClick={() => onSelect(s.key)} className="text-left group">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--${s.tone})` }} />
                <span className="text-[13px]" style={{ color: active ? 'var(--accent)' : 'var(--text2)', fontWeight: active ? 700 : 500 }}>{s.label}</span>
                <span className="ml-auto text-[15px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>{s.value}</span>
                <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: 'var(--text3)' }}>{p}%</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface3)', outline: active ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                <span className="block h-full rounded-full transition-all group-hover:brightness-95" style={{ width: `${Math.max(s.value > 0 ? 6 : 0, p)}%`, background: `var(--${s.tone})` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function KpisPage() {
  const ui = useUi();
  const perms = usePermissions('kpis');
  const [kpis, setKpis] = useState<Kpi[]>(() => kpiRepo.list());
  const [editing, setEditing] = useState<Kpi | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Kpi>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.kpis.v2') setKpis(kpiRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
  const del = (k: Kpi) => ui.confirm(`Delete "${k.name}"?`, 'You can undo this immediately afterwards.', () => { setKpis(kpiRepo.remove(k.id)); ui.toast('KPI deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setKpis(kpiRepo.save(k)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample KPIs and discards your changes.', () => { setKpis(kpiRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
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

      <ChartGrid sortKey="kpis-charts">
        <ChartPanel title="RAG overview" span={4} filterLabel={chipFor('rag:')} onClearFilter={filter.clear}>
          <RagOverview segments={ragSeg} total={kpis.length} activeKey={filter.activeKey} onSelect={selectRag} />
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
        <ImportExport spec={kpiIo} exportSource={rows} existing={kpis} canImport={perms.create} canExport={perms.export} onImported={(items) => setKpis(kpiRepo.bulkSave(items))} />
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
                        {perms.edit || perms.remove ? <RowActions onEdit={perms.edit ? () => setEditing(k) : undefined} onDelete={perms.remove ? () => del(k) : undefined} editLabel="Edit KPI" deleteLabel="Delete KPI" /> : <span style={{ color: 'var(--text3)' }}>—</span>}
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
