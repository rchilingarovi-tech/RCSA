import { useMemo, useState, type FormEvent } from 'react';
import { Modal } from '../../components/common/Modal';
import { Pill } from '../../components/common/Pill';
import { RowActions } from '../../components/common/RowActions';
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
import { awarenessRepo } from './repo';
import { COURSE_TYPES, METHODS, overdue, typeToken, type Course, type CourseType, type Method } from './types';

const TYPE_TONE = typeToken as Record<CourseType, Tone>;

function CourseModal({ course, onClose, onSave }: { course: Course | 'new'; onClose: () => void; onSave: (c: Course) => void }) {
  const ui = useUi();
  const e = course === 'new' ? null : course;
  const [name, setName] = useState(e?.course ?? '');
  const [type, setType] = useState<CourseType>(e?.type ?? 'Course');
  const [audience, setAudience] = useState(e?.audience ?? '');
  const [method, setMethod] = useState<Method>(e?.method ?? 'E-learning');
  const [due, setDue] = useState(e?.due ?? today());
  const [completion, setCompletion] = useState(String(e?.completion ?? '0'));

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a course / campaign name.', 'bg-orange-600'); return; }
    const c = Math.max(0, Math.min(100, Number(completion) || 0));
    onSave({ id: e ? e.id : awarenessRepo.nextId(), course: name.trim(), type, audience: audience.trim(), method, due, completion: c });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} title={e ? `Edit Course — ${e.id}` : 'New Course / Campaign'} subtitle="Awareness training item" maxWidth="max-w-lg">
      <form onSubmit={submit} className="p-6 space-y-4">
        <div><label className={lbl}>Course / campaign *</label><input value={name} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Annual security awareness 2026" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className={lbl}>Type</label><select value={type} onChange={(ev) => setType(ev.target.value as CourseType)} className={field}>{COURSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Method</label><select value={method} onChange={(ev) => setMethod(ev.target.value as Method)} className={field}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className={lbl}>Due date</label><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} className={field} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={lbl}>Audience</label><input value={audience} onChange={(ev) => setAudience(ev.target.value)} className={field} placeholder="e.g. All staff (5,500)" /></div>
          <div><label className={lbl}>Completion %</label><input value={completion} onChange={(ev) => setCompletion(ev.target.value)} className={field} inputMode="numeric" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-neutral px-4 py-2 border rounded text-sm">Cancel</button>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold">{e ? 'Save Course' : 'Create Course'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function AwarenessPage() {
  const ui = useUi();
  const perms = usePermissions('awareness');
  const [courses, setCourses] = useState<Course[]>(() => awarenessRepo.list());
  const [editing, setEditing] = useState<Course | 'new' | null>(null);
  const [q, setQ] = useState('');
  const filter = useChartFilter<Course>();

  const avg = courses.length ? Math.round(courses.reduce((s, c) => s + (Number(c.completion) || 0), 0) / courses.length) : 0;

  const typeSeg: DonutSegment[] = COURSE_TYPES.map((t) => ({ key: `ty:${t}`, label: t, tone: TYPE_TONE[t], value: courses.filter((c) => c.type === t).length }));
  const completionRows: BarRow[] = courses.map((c) => ({ key: `c:${c.id}`, label: c.course, tone: (c.completion >= 100 ? 'low' : overdue(c) ? 'crit' : 'accent') as Tone, value: c.completion }));

  const selectType = (key: string) => { const t = key.slice(3) as CourseType; filter.select(key, t, (c) => c.type === t); };
  const selectCourse = (key: string) => { const id = key.slice(2); const c = courses.find((x) => x.id === id); if (c) filter.select(key, c.course, (x) => x.id === id); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return courses;
    return courses.filter((c) => [c.id, c.course, c.type, c.audience, c.method].join(' ').toLowerCase().includes(s));
  }, [courses, q]);
  const rows = filter.apply(searched);
  const pager = usePaged(rows);

  const save = (c: Course) => { setCourses(awarenessRepo.save(c)); setEditing(null); ui.toast('Course saved', 'bg-green-700'); };
  const del = (c: Course) => ui.confirm(`Delete "${c.course}"?`, 'This cannot be undone.', () => { setCourses(awarenessRepo.remove(c.id)); ui.toast('Course deleted', 'bg-red-700'); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample courses and discards your changes.', () => { setCourses(awarenessRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); });

  const exportCsv = () => downloadCsv(
    `awareness-${today()}.csv`,
    ['ID', 'Course', 'Type', 'Audience', 'Method', 'Due', 'Completion %'],
    rows.map((c) => [c.id, c.course, c.type, c.audience, c.method, c.due, c.completion]),
  );

  const stats: { l: string; v: string | number; t?: Tone }[] = [
    { l: 'Active items', v: courses.length },
    { l: 'Avg completion', v: `${avg}%`, t: 'ok' },
    { l: 'Overdue', v: courses.filter(overdue).length, t: 'crit' },
    { l: 'Phishing sims', v: courses.filter((c) => c.type === 'Phishing simulation').length, t: 'purple' },
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
        <ChartPanel title="Programme mix" span={4} filterLabel={chipFor('ty:')} onClearFilter={filter.clear}>
          <DonutChart segments={typeSeg} center={`${avg}%`} sub="avg completion" activeKey={filter.activeKey} onSelect={selectType} />
        </ChartPanel>
        <ChartPanel title="Completion by course" span={8} filterLabel={chipFor('c:')} onClearFilter={filter.clear}>
          <HBarChart rows={completionRows} max={100} suffix="%" activeKey={filter.activeKey} onSelect={selectCourse} />
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        {perms.export && <button onClick={exportCsv} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Export CSV</button>}
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Course</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                <th className="text-left px-4 py-3">Course</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Method</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3" style={{ minWidth: 160 }}>Completion</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pager.pageItems.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No courses match{filter.active ? ' the selected chart slice' : ''}.</td></tr>
              ) : pager.pageItems.map((c) => {
                const late = overdue(c);
                return (
                  <tr key={c.id} className="risk-row">
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text)' }}>{c.course}</div>
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>{c.audience}</div>
                    </td>
                    <td className="px-4 py-3"><Pill text={c.type} k={TYPE_TONE[c.type]} /></td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text2)' }}>{c.method}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{late ? <Pill text={`Overdue · ${c.due}`} k="crit" /> : <span style={{ color: 'var(--text2)' }}>{c.due}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-full overflow-hidden" style={{ flex: 1, background: 'var(--surface3)' }}>
                          <div className="h-full rounded-full" style={{ width: `${c.completion}%`, background: c.completion >= 100 ? 'var(--low)' : late ? 'var(--crit)' : 'var(--accent)', minWidth: 3 }} />
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{c.completion}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 text-xs">
                        {perms.edit || perms.remove ? <RowActions onEdit={perms.edit ? () => setEditing(c) : undefined} onDelete={perms.remove ? () => del(c) : undefined} editLabel="Edit course" deleteLabel="Delete course" /> : <span style={{ color: 'var(--text3)' }}>—</span>}
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

      {editing && <CourseModal course={editing} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
