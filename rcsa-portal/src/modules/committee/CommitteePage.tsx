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
import { meetingIo } from './io';
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
import { takeIntent } from '../../lib/intent';
import { committeeRepo } from './repo';
import { MEETING_STATUSES, statusToken, type Meeting, type MeetingStatus } from './types';

const ST_TONE = statusToken as Record<MeetingStatus, Tone>;

function MeetingModal({ meeting, onClose, onSave }: { meeting: Meeting | 'new'; onClose: () => void; onSave: (m: Meeting) => void }) {
  const ui = useUi();
  const e = meeting === 'new' ? null : meeting;
  const [title, setTitle] = useState(e?.title ?? '');
  const [date, setDate] = useState(e?.date ?? today());
  const [status, setStatus] = useState<MeetingStatus>(e?.status ?? 'Scheduled');
  const [openActions, setOpenActions] = useState(String(e?.openActions ?? '0'));
  const [attendance, setAttendance] = useState(e?.attendance ?? '');
  const [decisions, setDecisions] = useState(e?.decisions ?? '');

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a meeting title.', 'bg-orange-600'); return; }
    const id = e ? e.id : allocateOrReport(() => committeeRepo.nextId(), (m) => ui.toast(m, 'bg-orange-600'));
    if (!id) return; // allocation failed: nothing saved, form stays open
    onSave({ id, title: title.trim(), date, status, openActions: Math.max(0, Number(openActions) || 0), attendance: attendance.trim(), decisions: decisions.trim() });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Meeting — ${e.id}` : 'New Meeting'} subtitle="Committee meeting record" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6 space-y-4">
        <label className="block"><span className={lbl}>Title *</span><input value={title} maxLength={200} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. InfoSec Steering Committee — Q3" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block"><span className={lbl}>Date</span><input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={field} /></label>
          <label className="block"><span className={lbl}>Status</span><select value={status} onChange={(ev) => setStatus(ev.target.value as MeetingStatus)} className={field}>{MEETING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="block"><span className={lbl}>Open actions</span><input value={openActions} onChange={(ev) => setOpenActions(ev.target.value)} className={field} inputMode="numeric" /></label>
        </div>
        <label className="block"><span className={lbl}>Attendance</span><input value={attendance} maxLength={1000} onChange={(ev) => setAttendance(ev.target.value)} className={field} placeholder="e.g. CISO, CIO, CRO" /></label>
        <label className="block"><span className={lbl}>Decisions / minutes</span><textarea value={decisions} maxLength={2000} onChange={(ev) => setDecisions(ev.target.value)} className={field} rows={3} placeholder="Key decisions and outcomes" /></label>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Meeting' : 'Create Meeting'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function CommitteePage() {
  const ui = useUi();
  const perms = usePermissions('committee');
  const [meetings, setMeetings] = useState<Meeting[]>(() => committeeRepo.list());
  const [editing, setEditing] = useState<Meeting | 'new' | null>(() => (takeIntent('new:committee') ? 'new' : null));
  const [q, setQ] = useState('');
  const filter = useChartFilter<Meeting>();

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.committee.v2') setMeetings(committeeRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const totalOpen = meetings.reduce((s, m) => s + (Number(m.openActions) || 0), 0);

  const statusSeg: DonutSegment[] = MEETING_STATUSES.map((s) => ({ key: `st:${s}`, label: s, tone: ST_TONE[s], value: meetings.filter((m) => m.status === s).length }));
  const actionRows: BarRow[] = meetings
    .filter((m) => m.openActions > 0)
    .map((m) => ({ key: `act:${m.id}`, label: m.title, tone: 'high' as Tone, value: m.openActions }))
    .sort((a, b) => b.value - a.value);

  const selectStatus = (key: string) => { const s = key.slice(3) as MeetingStatus; filter.select(key, s, (m) => m.status === s); };
  const selectAction = (key: string) => { const id = key.slice(4); const m = meetings.find((x) => x.id === id); if (m) filter.select(key, m.title, (x) => x.id === id); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return meetings;
    return meetings.filter((m) => [m.id, m.title, m.attendance, m.decisions, m.status].join(' ').toLowerCase().includes(s));
  }, [meetings, q]);
  // Sort runs after search + chart filter, so it composes with them.
  // Default: most recent meeting first.
  const { rows, sortable } = useTableSort(
    filter.apply(searched),
    {
      title: (m) => m.title,
      date: (m) => m.date,
      status: (m) => MEETING_STATUSES.indexOf(m.status),
      openActions: (m) => m.openActions,
    },
    { key: 'date', dir: 'desc' },
    'text-left px-4 py-3',
  );
  const pager = usePaged(rows);

  const save = (m: Meeting) => { setMeetings(committeeRepo.save(m)); setEditing(null); ui.toast('Meeting saved', 'bg-green-700'); };
  const del = (m: Meeting) => ui.confirm(`Delete "${m.title}"?`, 'You can undo this immediately afterwards.', () => { setMeetings(committeeRepo.remove(m.id)); ui.toast('Meeting deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setMeetings(committeeRepo.save(m)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample meetings and discards your changes.', () => { setMeetings(committeeRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
  const stats: Stat<Meeting>[] = [
    { l: 'Meetings logged', v: meetings.length },
    { l: 'Upcoming', v: meetings.filter((m) => m.status === 'Scheduled').length, t: 'info', k: 'stat:upcoming', pred: (m) => m.status === 'Scheduled' },
    { l: 'Open actions', v: totalOpen, t: 'high' },
    { l: 'Minutes issued', v: meetings.filter((m) => m.status === 'Minutes Issued').length, t: 'low', k: 'stat:minutes', pred: (m) => m.status === 'Minutes Issued' },
  ];

  return (
    <div className="p-6 space-y-4">
      <StatStrip stats={stats} filter={filter} />

      <ChartGrid sortKey="committee-charts" collapsible>
        <ChartPanel title="Meeting status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <DonutChart segments={statusSeg} center={String(totalOpen)} sub="open actions" activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
        <ChartPanel title="Open actions by meeting" span={8} filterLabel={chipFor('act:')} onClearFilter={filter.clear}>
          <HBarChart rows={actionRows} activeKey={filter.activeKey} onSelect={selectAction} />
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--link)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={meetingIo} exportSource={rows} existing={meetings} canImport={perms.create} canExport={perms.export} repo={committeeRepo} onRefreshed={setMeetings} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Meeting</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                {sortable('title', 'Meeting')}
                {sortable('date', 'Date')}
                {sortable('status', 'Status')}
                {sortable('openActions', 'Open actions')}
                <th className="text-left px-4 py-3">Decisions</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No meetings match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((m) => (
                <tr key={m.id} className="risk-row">
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: 'var(--text)' }}>{m.title}</div>
                    <div className="text-xs" style={{ color: 'var(--text3)' }}>{m.attendance || 'attendance tbc'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: 'var(--text2)' }}>{m.date}</td>
                  <td className="px-4 py-3"><Pill text={m.status} k={ST_TONE[m.status]} /></td>
                  <td className="px-4 py-3"><Pill text={String(m.openActions)} k={m.openActions > 0 ? 'high' : 'low'} /></td>
                  <td className="px-4 py-3 text-sm max-w-[280px]" style={{ color: 'var(--text2)' }}>{m.decisions || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 text-xs">
                      {perms.edit || perms.remove ? <RowActions onEdit={perms.edit ? () => setEditing(m) : undefined} onDelete={perms.remove ? () => del(m) : undefined} editLabel="Edit meeting" deleteLabel="Delete meeting" /> : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
      </div>

      {editing && <MeetingModal meeting={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
