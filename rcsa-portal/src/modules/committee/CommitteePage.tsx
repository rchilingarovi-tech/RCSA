import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { committeeRepo } from './repo';
import { MEETING_STATUSES, statusColor, type Meeting, type MeetingStatus } from './types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function MeetingModal({ meeting, onClose, onSave }: { meeting: Meeting | 'new'; onClose: () => void; onSave: (m: Meeting) => void }) {
  const ui = useUi();
  const e = meeting === 'new' ? null : meeting;
  const [title, setTitle] = useState(e?.title ?? '');
  const [date, setDate] = useState(e?.date ?? '');
  const [attendees, setAttendees] = useState(String(e?.attendees ?? ''));
  const [openActions, setOpenActions] = useState(String(e?.openActions ?? 0));
  const [status, setStatus] = useState<MeetingStatus>(e?.status ?? 'Scheduled');
  const [notes, setNotes] = useState(e?.notes ?? '');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!title.trim()) { ui.toast('Enter a meeting title.', 'bg-orange-600'); return; }
    onSave({
      id: e ? e.id : committeeRepo.nextId(),
      title: title.trim(),
      date,
      attendees: Math.max(0, Number(attendees) || 0),
      openActions: Math.max(0, Number(openActions) || 0),
      status,
      notes: notes.trim(),
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Meeting — ${e.id}` : 'New Meeting'} subtitle="Committee meeting" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Title *</label><input value={title} onChange={(ev) => setTitle(ev.target.value)} className={field} placeholder="e.g. Security Steering Committee — Q2" /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className={lbl}>Date</label><input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} className={field} /></div>
          <div><label className={lbl}>Attendees</label><input value={attendees} onChange={(ev) => setAttendees(ev.target.value)} className={field} inputMode="numeric" /></div>
          <div><label className={lbl}>Open actions</label><input value={openActions} onChange={(ev) => setOpenActions(ev.target.value)} className={field} inputMode="numeric" /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as MeetingStatus)} className={field}>{MEETING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div><label className={lbl}>Minutes / decisions</label><textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} className={field} rows={3} placeholder="Summary of decisions and actions…" /></div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Meeting</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function CommitteePage() {
  const ui = useUi();
  const perms = usePermissions('committee');
  const [meetings, setMeetings] = useState<Meeting[]>(() => committeeRepo.list());
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);

  const chips = useMemo(() => [
    { label: 'Meetings', value: meetings.length, color: 'var(--text)' },
    { label: 'Scheduled', value: meetings.filter((m) => m.status === 'Scheduled').length, color: 'var(--info)' },
    { label: 'Completed', value: meetings.filter((m) => m.status === 'Completed').length, color: 'var(--low)' },
    { label: 'Open Actions', value: meetings.reduce((s, m) => s + m.openActions, 0), color: 'var(--high)' },
  ], [meetings]);

  const sorted = useMemo(() => [...meetings].sort((a, b) => (a.date < b.date ? 1 : -1)), [meetings]);

  const save = (m: Meeting) => { setMeetings(committeeRepo.save(m)); setEditing(null); ui.toast('Meeting saved', 'bg-green-700'); };
  const del = (m: Meeting) => ui.confirm(`Delete "${m.title}"?`, 'This cannot be undone.', () => { setMeetings(committeeRepo.remove(m.id)); ui.toast('Meeting deleted', 'bg-red-700'); });

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Meeting</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample meetings and discards your changes.', () => { setMeetings(committeeRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="flex gap-3 flex-wrap">
          {chips.map((c) => (
            <div key={c.label} className="section-card px-4 py-3 flex-1 min-w-[150px]">
              <div className="text-[11px] mb-1" style={{ color: 'var(--text3)' }}>{c.label}</div>
              <div className="text-xl font-bold" style={{ color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-800">Committee Meetings</h2>
            <span className="text-xs text-gray-500">{meetings.length} meetings</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Meeting</th>
                  <th className={th}>Title</th>
                  <th className={th}>Date</th>
                  <th className={`${th} text-center`}>Attendees</th>
                  <th className={`${th} text-center`}>Open Actions</th>
                  <th className={th}>Status</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No meetings yet — add one to get started.</td></tr>
                ) : (
                  sorted.map((m) => (
                    <tr key={m.id} className="risk-row">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{m.id}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {m.title}
                        {m.notes && <div className="text-[11px] font-normal mt-0.5" style={{ color: 'var(--text3)' }}>{m.notes}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{m.date || '—'}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{m.attendees}</td>
                      <td className="px-4 py-3 text-center"><Pill text={String(m.openActions)} k={m.openActions > 3 ? 'crit' : 'mut'} /></td>
                      <td className="px-4 py-3"><Pill text={m.status} k={statusColor(m.status)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs">
                          {perms.edit && <button onClick={() => setEditing(m)} className="text-blue-600 hover:underline">Edit</button>}
                          {perms.remove && <button onClick={() => del(m)} className="text-red-500 hover:underline">Delete</button>}
                          {!perms.edit && !perms.remove && <span style={{ color: 'var(--text3)' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && <MeetingModal meeting={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
