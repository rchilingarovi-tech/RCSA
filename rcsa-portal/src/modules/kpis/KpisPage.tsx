import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Sparkline } from '../../components/charts/Sparkline';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { kpiRepo } from './repo';
import {
  FREQUENCIES,
  rag,
  ragColor,
  ragWord,
  improving,
  type Frequency,
  type Kpi,
} from './types';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function KpiModal({
  kpi,
  onClose,
  onSave,
}: {
  kpi: Kpi | 'new';
  onClose: () => void;
  onSave: (k: Kpi) => void;
}) {
  const ui = useUi();
  const editing = kpi === 'new' ? null : kpi;
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [owner, setOwner] = useState(editing?.owner ?? '');
  const [frequency, setFrequency] = useState<Frequency>(editing?.frequency ?? 'Monthly');
  const [unit, setUnit] = useState(editing?.unit ?? '');
  const [target, setTarget] = useState(String(editing?.target ?? ''));
  const [current, setCurrent] = useState(String(editing?.current ?? ''));
  const [lowerBetter, setLowerBetter] = useState(editing?.lowerBetter ?? false);
  const [history, setHistory] = useState((editing?.history ?? []).join(', '));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { ui.toast('Enter a KPI name.', 'bg-orange-600'); return; }
    const t = Number(target);
    const c = Number(current);
    if (!Number.isFinite(t) || !Number.isFinite(c)) { ui.toast('Target and current must be numbers.', 'bg-orange-600'); return; }
    const hist = history
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    onSave({
      id: editing ? editing.id : kpiRepo.nextId(),
      name: name.trim(),
      category: category.trim() || 'General',
      owner: owner.trim(),
      frequency,
      unit: unit.trim(),
      target: t,
      current: c,
      lowerBetter,
      history: hist.length ? hist : [c],
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `Edit KPI — ${editing.id}` : 'New KPI'}
      subtitle="Performance metric"
      maxWidth="max-w-xl"
    >
      <form onSubmit={submit} className="p-6 space-y-4">
        <div>
          <label className={lbl}>Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="e.g. Mean time to detect" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Category</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={field} placeholder="e.g. Incident" />
          </div>
          <div>
            <label className={lbl}>Owner</label>
            <input value={owner} onChange={(e) => setOwner(e.target.value)} className={field} placeholder="Name / team" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className={lbl}>Current *</label>
            <input value={current} onChange={(e) => setCurrent(e.target.value)} className={field} inputMode="decimal" />
          </div>
          <div>
            <label className={lbl}>Target *</label>
            <input value={target} onChange={(e) => setTarget(e.target.value)} className={field} inputMode="decimal" />
          </div>
          <div>
            <label className={lbl}>Unit</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={field} placeholder="% / hrs / count" />
          </div>
          <div>
            <label className={lbl}>Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className={field}>
              {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Direction</label>
            <select value={lowerBetter ? 'lower' : 'higher'} onChange={(e) => setLowerBetter(e.target.value === 'lower')} className={field}>
              <option value="higher">Higher is better</option>
              <option value="lower">Lower is better</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Trend history (comma-separated)</label>
            <input value={history} onChange={(e) => setHistory(e.target.value)} className={field} placeholder="42, 40, 38, 35" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save KPI</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────
function KpiCard({ k, onEdit, onDelete }: { k: Kpi; onEdit?: () => void; onDelete?: () => void }) {
  const r = rag(k);
  const color = ragColor(r);
  const up = improving(k);
  return (
    <div className="section-card relative p-4 pl-5 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text)' }}>{k.name}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{k.category} · {k.frequency}</div>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `var(--${r}-bg)`, color }}>
          {ragWord(r)}
        </span>
      </div>
      <div className="flex items-end gap-4">
        <div className="shrink-0">
          <div className="text-2xl font-bold leading-none" style={{ color }}>
            {k.current}<span className="text-[13px] font-medium" style={{ color: 'var(--text3)' }}> {k.unit}</span>
          </div>
          <div className="text-[11px] mt-1" style={{ color: 'var(--text3)' }}>Target {k.target} {k.unit}</div>
        </div>
        <div className="flex-1 min-w-0"><Sparkline values={k.history} color={color} /></div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 text-[11px] font-semibold" style={{ color: up ? 'var(--low)' : 'var(--crit)' }}>
        <span>{up ? '▲' : '▼'}</span>{up ? 'Improving' : 'Declining'}
        <span className="ml-auto font-normal truncate" style={{ color: 'var(--text3)' }}>{k.owner}</span>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-3 mt-2.5 pt-2.5 border-t text-xs">
          {onEdit && <button onClick={onEdit} className="text-blue-600 hover:underline">Edit</button>}
          {onDelete && <button onClick={onDelete} className="text-red-500 hover:underline">Delete</button>}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function KpisPage() {
  const ui = useUi();
  const perms = usePermissions('kpis');
  const [kpis, setKpis] = useState<Kpi[]>(() => kpiRepo.list());
  const [editing, setEditing] = useState<Kpi | 'new' | null>(null);

  const summary = useMemo(() => {
    const s = { low: 0, med: 0, crit: 0 };
    kpis.forEach((k) => (s[rag(k)] += 1));
    return s;
  }, [kpis]);

  const save = (k: Kpi) => {
    setKpis(kpiRepo.save(k));
    setEditing(null);
    ui.toast('KPI saved', 'bg-green-700');
  };
  const del = (k: Kpi) =>
    ui.confirm(`Delete "${k.name}"?`, 'This cannot be undone.', () => {
      setKpis(kpiRepo.remove(k.id));
      ui.toast('KPI deleted', 'bg-red-700');
    });

  const chips = [
    { label: 'On Track', value: summary.low, k: 'low' },
    { label: 'At Risk', value: summary.med, k: 'med' },
    { label: 'Off Track', value: summary.crit, k: 'crit' },
  ];

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New KPI</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample KPIs and discards your changes.', () => { setKpis(kpiRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Summary */}
        <div className="flex gap-3 flex-wrap">
          {chips.map((c) => (
            <div key={c.label} className="section-card flex items-center gap-3.5 px-4 py-3.5 flex-1 min-w-[160px]">
              <span
                className="w-11 h-11 rounded-[11px] flex items-center justify-center text-xl font-bold"
                style={{ background: `var(--${c.k}-bg)`, color: `var(--${c.k})` }}
              >
                {c.value}
              </span>
              <div>
                <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{c.label}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--text3)' }}>metrics</div>
              </div>
            </div>
          ))}
        </div>

        {/* KPI grid */}
        {kpis.length === 0 ? (
          <div className="section-card p-10 text-center text-gray-400">No KPIs yet — add one to get started.</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
            {kpis.map((k) => (
              <KpiCard key={k.id} k={k} onEdit={perms.edit ? () => setEditing(k) : undefined} onDelete={perms.remove ? () => del(k) : undefined} />
            ))}
          </div>
        )}
      </div>

      {editing && <KpiModal kpi={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
