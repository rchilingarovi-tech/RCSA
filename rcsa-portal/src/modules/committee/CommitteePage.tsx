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
  HBarChart,
  useChartFilter,
  type BarRow,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
import { downloadCsv } from '../../lib/csv';
import { today } from '../../domain/scoring';
import { committeeRepo } from './repo';
import { MEETING_STATUSES, statusToken, type Meeting, type MeetingStatus } from './types';

const ST_TONE = statusToken as Record<MeetingStatus, Tone>;

function MeetingModal({ meeting, onClose, onSave }: { meeting: Meeting | 'new'; onClose: () => void; onSave: (m: Meeting) => void }) {
  const ui = useUi();
  const e = meeting === 'new' ? null : meeting;
  const [title, setTitle] = useState(e?.title ?? '');
  const [date, setDate] = useState(e?.date ?? today);
  const [status, setStatus] = useState<MeetingStatus>(e?.status ?? 'Scheduled');
  const [openActions, setOpenActions] = useState(String(e?.openActions ?? '0'));
  const [attendance, setAttendance] = useState(e?.attendance ?? '');
  const [decisions, setDecisions] = useState(e?.decisions ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a meeting title.', 'bg-orange-600'); return; }
    onSave({ id: e ? e.id : committeeRepo.nextId(), title: title.trim(), date, status, openActions: Math.max(0, Number(openActions) || 0), attendance: attendance.trim(), decisions: decisions.trim() });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Meeting — ${e.id}` : 'New Meeting'} subtitle="Committee meeting record" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. InfoSec Steering Committee — Q3" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Date</label><input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Status</label><select value={status} onChange={(ev) => setStatus(ev.target.value as MeetingStatus)} className={field}>{MEETING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={lbl}>Open actions</label><input value={openActions} onChange={(ev) => setOpenActions(ev.target.value)} className={field} inputMode="numeric" /></div>
        </div>
        <div><label className={lbl}>Attendance</label><input value={attendance} onChange={(ev) => setAttendance(ev.target.value)} className={field} placeholder="e.g. CISO, CIO, CRO" /></div>
        <div><label className={lbl}>Decisions / minutes</label><textarea value={decisions} onChange={(ev) => setDecisions(ev.target.value)} className={field} rows={3} placeholder="Key decisions and outcomes" /></div>
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
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Meeting>();

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
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (m: Meeting) => { setMeetings(committeeRepo.save(m)); setEditing(null); ui.toast('Meeting saved', 'bg-green-700'); };
  const del = (m: Meeting) => ui.confirm(`Delete "${m.title}"?`, 'This cannot be undone.', () => { setMeetings(committeeRepo.remove(m.id)); ui.toast('Meeting deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample meetings and discards your changes.', () => { setMeetings(committeeRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const exportCsv = () => downloadCsv(
    `committee-meetings-${today}.csv`,
    ['ID', 'Title', 'Date', 'Status', 'Open actions', 'Attendance', 'Decisions'],
    rows.map((m) => [m.id, m.title, m.date, m.status, m.openActions, m.attendance, m.decisions]),
  );

  const stats: { l: string; v: number; t?: Tone }[] = [
    { l: 'Meetings logged', v: meetings.length },
    { l: 'Upcoming', v: meetings.filter((m) => m.status === 'Scheduled').length, t: 'info' },
    { l: 'Open actions', v: totalOpen, t: 'high' },
    { l: 'Minutes issued', v: meetings.filter((m) => m.status === 'Minutes Issued').length, t: 'low' },
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
        <ChartPanel title="Meeting status" span={4} filterLabel={chipFor('st:')} onClearFilter={filter.clear}>
          <DonutChart segments={statusSeg} center={String(totalOpen)} sub="open actions" activeKey={filter.activeKey} onSelect={selectStatus} />
        </ChartPanel>
        <ChartPanel title="Open actions by meeting" span={8} filterLabel={chipFor('act:')} onClearFilter={filter.clear}>
          <HBarChart rows={actionRows} activeKey={filter.activeKey} onSelect={selectAction} />
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search meetings…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        {perms.export && <button onClick={exportCsv} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Meeting</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">Meeting</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Open actions</th>
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
                      {perms.edit && <button onClick={() => setEditing(m)} className="text-blue-600 hover:underline">Edit</button>}
                      {perms.remove && <button onClick={() => del(m)} className="text-red-500 hover:underline">Delete</button>}
                      {!perms.edit && !perms.remove && <span style={{ color: 'var(--text3)' }}>—</span>}
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
