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
import { courseIo } from './io';
import {
  ChartGrid,
  ChartPanel,
  DonutChart,
  useChartFilter,
  type DonutSegment,
  type Tone,
} from '../../components/charts/primitives';
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

  // Any field change arms the discard guard (change events bubble to the form).
  const [dirty, setDirty] = useState(false);

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!name.trim()) { ui.toast('Enter a course / campaign name.', 'bg-orange-600'); return; }
    const c = Math.max(0, Math.min(100, Number(completion) || 0));
    const id = e ? e.id : allocateOrReport(() => awarenessRepo.nextId(), (m) => ui.toast(m, 'bg-orange-600'));
    if (!id) return; // allocation failed: nothing saved, form stays open
    onSave({ id, course: name.trim(), type, audience: audience.trim(), method, due, completion: c });
  }

  const field = 'w-full border rounded px-3 py-2 text-sm';
  const lbl = 'text-xs font-semibold text-gray-600 block mb-1';

  return (
    <Modal open onClose={onClose} dirty={dirty} title={e ? `Edit Course — ${e.id}` : 'New Course / Campaign'} subtitle="Awareness training item" maxWidth="max-w-lg">
      <form onSubmit={submit} onChange={() => setDirty(true)} className="p-6 space-y-4">
        <label className="block"><span className={lbl}>Course / campaign *</span><input value={name} maxLength={200} onChange={(ev) => setName(ev.target.value)} className={field} placeholder="e.g. Annual security awareness 2026" /></label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block"><span className={lbl}>Type</span><select value={type} onChange={(ev) => setType(ev.target.value as CourseType)} className={field}>{COURSE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="block"><span className={lbl}>Method</span><select value={method} onChange={(ev) => setMethod(ev.target.value as Method)} className={field}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
          <label className="block"><span className={lbl}>Due date</span><input type="date" value={due} onChange={(ev) => setDue(ev.target.value)} className={field} /></label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block"><span className={lbl}>Audience</span><input value={audience} maxLength={120} onChange={(ev) => setAudience(ev.target.value)} className={field} placeholder="e.g. All staff (5,500)" /></label>
          <label className="block"><span className={lbl}>Completion %</span><input value={completion} onChange={(ev) => setCompletion(ev.target.value)} className={field} inputMode="numeric" /></label>
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

  // Multi-tab safety: re-read when another tab writes the store.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'infosec.awareness.v2') setCourses(awarenessRepo.list());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const avg = courses.length ? Math.round(courses.reduce((s, c) => s + (Number(c.completion) || 0), 0) / courses.length) : 0;

  const typeSeg: DonutSegment[] = COURSE_TYPES.map((t) => ({ key: `ty:${t}`, label: t, tone: TYPE_TONE[t], value: courses.filter((c) => c.type === t).length }));

  // Signature widget: completion board — least-complete first, with audience /
  // method context and a due chip. Click a row to filter the table.
  const board = [...courses].sort((a, b) => a.completion - b.completion);

  const selectType = (key: string) => { const t = key.slice(3) as CourseType; filter.select(key, t, (c) => c.type === t); };
  const selectCourse = (key: string) => { const id = key.slice(2); const c = courses.find((x) => x.id === id); if (c) filter.select(key, c.course, (x) => x.id === id); };
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return courses;
    return courses.filter((c) => [c.id, c.course, c.type, c.audience, c.method].join(' ').toLowerCase().includes(s));
  }, [courses, q]);
  // Sort runs after search + chart filter, so it composes with them.
  // Default: soonest due first.
  const { rows, sortable } = useTableSort(
    filter.apply(searched),
    {
      course: (c) => c.course,
      type: (c) => COURSE_TYPES.indexOf(c.type),
      method: (c) => METHODS.indexOf(c.method),
      due: (c) => c.due,
      completion: (c) => c.completion,
    },
    { key: 'due', dir: 'asc' },
    'text-left px-4 py-3',
  );
  const pager = usePaged(rows);

  const save = (c: Course) => { setCourses(awarenessRepo.save(c)); setEditing(null); ui.toast('Course saved', 'bg-green-700'); };
  const del = (c: Course) => ui.confirm(`Delete "${c.course}"?`, 'You can undo this immediately afterwards.', () => { setCourses(awarenessRepo.remove(c.id)); ui.toast('Course deleted', { color: 'bg-red-700', action: { label: 'Undo', onClick: () => setCourses(awarenessRepo.save(c)) } }); });
  const resetDemo = () => ui.confirm('Reset demo data?', 'Restores the sample courses and discards your changes.', () => { setCourses(awarenessRepo.reset()); ui.toast('Demo data restored', 'bg-green-700'); }, { confirmLabel: 'Reset data' });
  const stats: Stat<Course>[] = [
    { l: 'Active items', v: courses.length },
    { l: 'Avg completion', v: `${avg}%`, t: 'ok' },
    { l: 'Overdue', v: courses.filter(overdue).length, t: 'crit', k: 'stat:overdue', pred: overdue },
    { l: 'Phishing sims', v: courses.filter((c) => c.type === 'Phishing simulation').length, t: 'purple', k: 'stat:phish', pred: (c) => c.type === 'Phishing simulation' },
  ];

  return (
    <div className="p-6 space-y-4">
      <StatStrip stats={stats} filter={filter} />

      <ChartGrid sortKey="awareness-charts" collapsible>
        <ChartPanel title="Programme mix" span={4} filterLabel={chipFor('ty:')} onClearFilter={filter.clear}>
          <DonutChart segments={typeSeg} center={`${avg}%`} sub="avg completion" activeKey={filter.activeKey} onSelect={selectType} />
        </ChartPanel>
        <ChartPanel title="Completion board" span={8} filterLabel={chipFor('c:')} onClearFilter={filter.clear}>
          {board.length === 0 ? (
            <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No courses yet.</div>
          ) : (
            <div className="space-y-2">
              {board.map((c) => {
                const late = overdue(c);
                const fillColor = c.completion >= 100 ? 'var(--low)' : late ? 'var(--crit)' : 'var(--accent)';
                const key = `c:${c.id}`;
                const active = filter.activeKey === key;
                return (
                  <button key={c.id} onClick={() => selectCourse(key)} className="w-full flex items-center gap-3 text-left group">
                    <span className="w-44 shrink-0 min-w-0">
                      <span className="block text-[12px] font-semibold truncate" title={c.course} style={{ color: active ? 'var(--accent)' : 'var(--text)' }}>{c.course}</span>
                      <span className="block text-[10.5px] truncate" style={{ color: 'var(--text3)' }}>{c.audience || 'All staff'} · {c.method}</span>
                    </span>
                    <span className="relative flex-1 h-4 rounded-md overflow-hidden" style={{ background: 'var(--surface3)', outline: active ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                      <span className="absolute inset-y-0 left-0 rounded-md transition-all group-hover:brightness-95" style={{ width: `${Math.max(c.completion > 0 ? 4 : 0, c.completion)}%`, background: fillColor }} />
                    </span>
                    <span className="w-9 text-right text-[12px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>{c.completion}%</span>
                    <span className="w-[86px] text-right">
                      {late
                        ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>Overdue</span>
                        : c.completion >= 100
                          ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--low-bg)', color: 'var(--low)' }}>Done</span>
                          : <span className="text-[10.5px]" style={{ color: 'var(--text3)' }}>{c.due || '—'}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </ChartPanel>
      </ChartGrid>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="border rounded-lg px-3 py-2 text-sm" style={{ maxWidth: 280, background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        {filter.active && <button onClick={filter.clear} className="text-[12px] font-semibold px-2.5 py-1.5 rounded-lg border" style={{ color: 'var(--link)', borderColor: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
        <div className="flex-1" />
        <ImportExport spec={courseIo} exportSource={rows} existing={courses} canImport={perms.create} canExport={perms.export} repo={awarenessRepo} onRefreshed={setCourses} />
        {perms.remove && <button onClick={resetDemo} className="btn-neutral bg-white border px-3 py-2 rounded-lg text-sm font-medium">Reset demo data</button>}
        {perms.create && <button onClick={() => setEditing('new')} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow">+ New Course</button>}
      </div>

      <div className="section-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
              <tr>
                {sortable('course', 'Course')}
                {sortable('type', 'Type')}
                {sortable('method', 'Method')}
                {sortable('due', 'Due')}
                {sortable('completion', 'Completion', '', { minWidth: 160 })}
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
