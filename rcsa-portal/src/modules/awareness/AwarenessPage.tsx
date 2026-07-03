import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { ProgressBar } from '../../components/common/ProgressBar';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { awarenessRepo } from './repo';
import {
  DELIVERIES,
  TRAINING_STATUSES,
  deliveryColor,
  statusColor,
  type Course,
  type Delivery,
  type TrainingStatus,
} from './types';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

// ── Add / edit modal ──────────────────────────────────────────────────────────
function CourseModal({ course, onClose, onSave }: { course: Course | 'new'; onClose: () => void; onSave: (c: Course) => void }) {
  const ui = useUi();
  const e = course === 'new' ? null : course;
  const [name, setName] = useState(e?.name ?? '');
  const [audience, setAudience] = useState(e?.audience ?? '');
  const [delivery, setDelivery] = useState<Delivery>(e?.delivery ?? 'E-learning');
  const [due, setDue] = useState(e?.due ?? '');
  const [completion, setCompletion] = useState(String(e?.completion ?? 0));
  const [status, setStatus] = useState<TrainingStatus>(e?.status ?? 'Assigned');

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a course name.', 'bg-orange-600'); return; }
    const c = Math.max(0, Math.min(100, Number(completion) || 0));
    onSave({
      id: e ? e.id : awarenessRepo.nextId(),
      name: name.trim(),
      audience: audience.trim(),
      delivery,
      due,
      completion: status === 'Completed' ? 100 : c,
      status,
    });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Course — ${e.id}` : 'New Course'} subtitle="Awareness training" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Course name *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Security Awareness Foundations" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Audience</label><input value={audience} onChange={(ev) => setAudience(ev.target.value)} className={field} placeholder="e.g. All Employees" /></div>
          <div>
            <label className={lbl}>Delivery</label>
            <select value={delivery} onChange={(ev) => setDelivery(ev.target.value as Delivery)} className={field}>{DELIVERIES.map((d) => <option key={d}>{d}</option>)}</select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Due date</label><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} className={field} /></div>
          <div>
            <label className={lbl}>Status</label>
            <select value={status} onChange={(ev) => setStatus(ev.target.value as TrainingStatus)} className={field}>{TRAINING_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div><label className={lbl}>Completion (%)</label><input value={completion} onChange={(ev) => setCompletion(ev.target.value)} className={field} inputMode="numeric" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">Save Course</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function AwarenessPage() {
  const ui = useUi();
  const perms = usePermissions('awareness');
  const [courses, setCourses] = useState<Course[]>(() => awarenessRepo.list());
  const [editing, setEditing] = useState<Course | 'new' | null>(null);

  const chips = useMemo(() => {
    const avg = courses.length ? Math.round(courses.reduce((s, c) => s + c.completion, 0) / courses.length) : 0;
    return [
      { label: 'Courses', value: courses.length, color: 'var(--text)' },
      { label: 'In Progress', value: courses.filter((c) => c.status === 'In Progress').length, color: 'var(--info)' },
      { label: 'Completed', value: courses.filter((c) => c.status === 'Completed').length, color: 'var(--low)' },
      { label: 'Avg Completion', value: `${avg}%`, color: 'var(--accent)' },
    ];
  }, [courses]);

  const save = (c: Course) => { setCourses(awarenessRepo.save(c)); setEditing(null); ui.toast('Course saved', 'bg-green-700'); };
  const del = (c: Course) => ui.confirm(`Delete "${c.name}"?`, 'This cannot be undone.', () => { setCourses(awarenessRepo.remove(c.id)); ui.toast('Course deleted', 'bg-red-700'); });

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Course</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'Restores the original sample courses and discards your changes.', () => { setCourses(awarenessRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); })}
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
            <h2 className="text-base font-semibold text-gray-800">Training Programmes</h2>
            <span className="text-xs text-gray-500">{courses.length} courses</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Course</th>
                  <th className={th}>Audience</th>
                  <th className={th}>Delivery</th>
                  <th className={th}>Due</th>
                  <th className={th}>Completion</th>
                  <th className={th}>Status</th>
                  <th className={th}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courses.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No courses yet — add one to get started.</td></tr>
                ) : (
                  courses.map((c) => (
                    <tr key={c.id} className="risk-row">
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.audience}</td>
                      <td className="px-4 py-3"><Pill text={c.delivery} k={deliveryColor(c.delivery)} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{c.due || '—'}</td>
                      <td className="px-4 py-3"><ProgressBar pct={c.completion} color={c.completion === 100 ? 'var(--low)' : c.status === 'Overdue' ? 'var(--crit)' : c.completion < 60 ? 'var(--high)' : 'var(--accent)'} /></td>
                      <td className="px-4 py-3"><Pill text={c.status} k={statusColor(c.status)} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs">
                          {perms.edit && <button onClick={() => setEditing(c)} className="text-blue-600 hover:underline">Edit</button>}
                          {perms.remove && <button onClick={() => del(c)} className="text-red-500 hover:underline">Delete</button>}
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

      {editing && <CourseModal course={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
