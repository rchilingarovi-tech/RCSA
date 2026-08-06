import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { StatStrip, type Stat } from '../../components/common/StatStrip';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { useTableSort } from '../../components/common/useTableSort';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { ImportExport } from '../../components/common/ImportExport';
import { accessIo } from './io';
import {
  ChartGrid,
  ChartPanel,
  DonutChart,
  useChartFilter,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { today } from '../../domain/scoring';
import { accessRepo } from './repo';
import { overdue, type AccessReview } from './types';

function AccessModal({ review, onClose, onSave }: { review: AccessReview | 'new'; onClose: () => void; onSave: (r: AccessReview) => void }) {
  const ui = useUi();
  const e = review === 'new' ? null : review;
  const [campaign, setCampaign] = useState(e?.campaign ?? '');
  const [scope, setScope] = useState(e?.scope ?? '');
  const [period, setPeriod] = useState(e?.period ?? '');
  const [reviewer, setReviewer] = useState(e?.reviewer ?? '');
  const [due, setDue] = useState(e?.due ?? today());
  const [progress, setProgress] = useState(String(e?.progress ?? '0'));

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!campaign.trim()) { ui.toast('Enter a campaign name.', 'bg-orange-600'); return; }
    const p = Math.max(0, Math.min(100, Number(progress) || 0));
    onSave({ id: e ? e.id : accessRepo.nextId(), campaign: campaign.trim(), scope: scope.trim(), period: period.trim(), reviewer: reviewer.trim(), due, progress: p });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Campaign — ${e.id}` : 'New Access Review'} subtitle="Entitlement review campaign" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6 space-y-4">
        <label className="block"><span className={lbl}>Campaign *</span><input value={campaign} maxLength={200} onChange={(ev) => setCampaign(ev.target.value)} className={field} placeholder="e.g. Q2 privileged access review" /></label>
        <label className="block"><span className={lbl}>Scope</span><input value={scope} maxLength={200} onChange={(ev) => setScope(ev.target.value)} className={field} placeholder="What is being reviewed" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block"><span className={lbl}>Period</span><input value={period} maxLength={40} onChange={(ev) => setPeriod(ev.target.value)} className={field} placeholder="2026-Q2" /></label>
          <label className="block"><span className={lbl}>Reviewer</span><input value={reviewer} maxLength={120} onChange={(ev) => setReviewer(ev.target.value)} className={field} placeholder="Reviewer / team" /></label>
          <label className="block"><span className={lbl}>Due date</span><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} className={field} /></label>
        </div>
        <label className="block"><span className={lbl}>Progress %</span><input value={progress} onChange={(ev) => setProgress(ev.target.value)} className={field} inputMode="numeric" placeholder="0–100" /></label>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Campaign' : 'Create Campaign'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function AccessPage() {
  const ui = useUi();
  const perms = usePermissions('access-reviews');
  const [reviews, setReviews] = useState<AccessReview[]>(() => accessRepo.list());
  const [editing, setEditing] = useState<AccessReview | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<AccessReview>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.access.v2') setReviews(accessRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const STATES = [
    { key: 'st:Completed', label: 'Completed', tone: 'low' as Tone, pred: (r: AccessReview) => r.progress >= 100 },
    { key: 'st:OnTrack', label: 'On track', tone: 'info' as Tone, pred: (r: AccessReview) => r.progress < 100 && !overdue(r) },
    { key: 'st:Overdue', label: 'Overdue', tone: 'crit' as Tone, pred: (r: AccessReview) => overdue(r) },
  ];

  const stateSeg: DonutSegment[] = STATES.map((s) => ({ key: s.key, label: s.label, tone: s.tone, value: reviews.filter(s.pred).length }));

  // Signature widget: campaign progress board — least-complete first, with
  // reviewer / period context and a due chip. Click a row to filter the table.
  const board = [...reviews].sort((a, b) => a.progress - b.progress);

  const selectState = (key: string) => { const s = STATES.find((x) => x.key === key); if (s) filter.select(s.key, s.label, s.pred); };
  const selectCampaign = (key: string) => { const id = key.slice(5); const r = reviews.find((x) => x.id === id); if (r) filter.select(key, r.campaign, (x) => x.id === id); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return reviews;
    return reviews.filter((r) => [r.id, r.campaign, r.scope, r.period, r.reviewer].join(' ').toLowerCase().includes(s));
  }, [reviews, q]);
  // Sort runs after search + chart filter, so it composes with them.
  // Default: soonest review deadline first.
  const { rows, sortable } = useTableSort(
    filter.apply(searched),
    {
      campaign: (r) => r.campaign,
      period: (r) => r.period,
      reviewer: (r) => r.reviewer,
      due: (r) => r.due,
      progress: (r) => r.progress,
    },
    { key: 'due', dir: 'asc' },
    'text-left px-4 py-3',
  );
  const pager = usePaged(rows);

  const save = (r: AccessReview) => { setReviews(accessRepo.save(r)); setEditing(null); ui.toast('Campaign saved', 'bg-green-700'); };
  const del = (r: AccessReview) => ui.confirm(`Delete "${r.campaign}"?`, 'You can undo this immediately afterwards.', () => { setReviews(accessRepo.remove(r.id)); ui.toast('Campaign deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setReviews(accessRepo.save(r)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample campaigns and discards your changes.', () => { setReviews(accessRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
  const avg = reviews.length ? Math.round(reviews.reduce((s, r) => s + (Number(r.progress) || 0), 0) / reviews.length) : 0;
  const stats: Stat<AccessReview>[] = [
    { l: 'Campaigns', v: reviews.length },
    { l: 'Avg completion', v: `${avg}%`, t: 'ok' },
    { l: 'Overdue', v: reviews.filter(overdue).length, t: 'crit', k: 'stat:overdue', pred: overdue },
    { l: 'Completed', v: reviews.filter((r) => r.progress >= 100).length, t: 'low', k: 'stat:done', pred: (r) => r.progress >= 100 },
  ];

  return (
    <div className="p-6 space-y-4">
      <StatStrip stats={stats} filter={filter} />

      <ChartGrid sortKey="access-charts">
        <ChartPanel title="Campaign state" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <DonutChart segments={stateSeg} center={String(reviews.length)} sub="campaigns" activeKey={filter.activeKey} onSelect={selectState} />
        </ChartPanel>
        <ChartPanel title="Campaign progress board" span={8} filterLabel={chipFor('camp:')} onClearFilter={filter.clear}>
          {board.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No campaigns yet.</div>
          ) : (
            <div className="space-y-2">
              {board.map((r) => {
                const late = overdue(r);
                const fillColor = r.progress >= 100 ? 'var(--low)' : late ? 'var(--crit)' : 'var(--accent)';
                const key = `camp:${r.id}`;
                const active = filter.activeKey === key;
                return (
                  <button key={r.id} onClick={() => selectCampaign(key)} className="w-full flex items-center gap-3 text-left group">
                    <span className="w-44 shrink-0 min-w-0">
                      <span className="block text-[12px] font-semibold truncate" title={r.campaign} style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>{r.campaign}</span>
                      <span className="block text-[10.5px] truncate" style={{ color: 'var(--text3)' }}>{r.reviewer || 'Unassigned'} · {r.period}</span>
                    </span>
                    <span className="relative flex-1 h-4 rounded-md overflow-hidden" style={{ background: 'var(--surface3)', outline: active ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                      <span className="absolute inset-y-0 left-0 rounded-md transition-all group-hover:brightness-95" style={{ width: `${Math.max(r.progress > 0 ? 4 : 0, r.progress)}%`, background: fillColor }} />
                    </span>
                    <span className="w-9 text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>{r.progress}%</span>
                    <span className="w-[86px] text-right">
                      {late
                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>Overdue</span>
                        : r.progress >= 100
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--low-bg)', color: 'var(--low)' }}>Done</span>
                          : <span className="text-[10.5px]" style={{ color: 'var(--text3)' }}>{r.due || '—'}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--link)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={accessIo} exportSource={rows} existing={reviews} canImport={perms.create} canExport={perms.export} onImported={(items) => setReviews(accessRepo.bulkSave(items))} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Campaign</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                {sortable('campaign', 'Campaign')}
                {sortable('period', 'Period')}
                {sortable('reviewer', 'Reviewer')}
                {sortable('due', 'Due')}
                {sortable('progress', 'Progress', '', { minWidth: 160 })}
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No campaigns match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((r) => {
                const late = overdue(r);
                return (
                  <tr key={r.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{r.campaign}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{r.scope}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text2)' }}>{r.period}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text2)' }}>{r.reviewer}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{late ? <Pill text={`Overdue · ${r.due}`} k="crit" /> : <span style={{ color: 'var(--text2)' }}>{r.due}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full overflow-hidden" style={{ flex: 1, background: 'var(--surface3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${r.progress}%`, background: r.progress >= 100 ? 'var(--low)' : late ? 'var(--crit)' : 'var(--accent)', minWidth: 3 }} />
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{r.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        {perms.edit || perms.remove ? <RowActions onEdit={perms.edit ? () => setEditing(r) : undefined} onDelete={perms.remove ? () => del(r) : undefined} editLabel="Edit campaign" deleteLabel="Delete campaign" /> : <span style={{ color: 'var(--text3)' }}>—</span>}
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

      {editing && <AccessModal review={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
