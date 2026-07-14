import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '../../state/AppStore';
import { useNav } from '../../state/NavContext';
import { PageHeader } from '../rcsa/PageHeader';
import { Modal } from '../../components/common/Modal';
import { vendorRepo } from '../vendors/repo';
import { accessRepo } from '../access/repo';
import { policyRepo } from '../policies/repo';
import { awarenessRepo } from '../awareness/repo';
import { findingsRepo } from '../findings/repo';
import { vulnRepo } from '../vulns/repo';
import {
  agendaBuckets,
  buildCalendarEvents,
  byDate,
  fmtLong,
  iso,
  LAYERS,
  layerLabel,
  layerTone,
  monthCells,
  MONTHS,
  todayIso,
  weekCells,
  WEEKDAYS,
  type CalData,
  type CalEvent,
  type LayerKey,
} from './events';

type View = 'month' | 'week' | 'day' | 'agenda';

const critTone = (c: string): string =>
  c === 'Critical' ? 'crit' : c === 'High' ? 'high' : c === 'Medium' ? 'med' : c === 'Low' ? 'low' : 'mut';

const readExternal = () => ({
  vendors: vendorRepo.list(),
  accessReviews: accessRepo.list(),
  policies: policyRepo.list(),
  courses: awarenessRepo.list(),
  findings: findingsRepo.list(),
  vulns: vulnRepo.list(),
});

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── Small building blocks ────────────────────────────────────────────────────
function Chip({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  const tone = layerTone(e.layer);
  const strong = e.status === 'Overdue' ? 'crit' : tone;
  return (
    <button
      onClick={(ev) => { ev.stopPropagation(); onClick(e); }}
      title={`${e.id} · ${e.title}`}
      className="w-full text-left rounded px-1.5 py-[3px] text-[10px] flex items-center gap-1 overflow-hidden transition-all hover:brightness-95"
      style={{ background: `var(--${tone}-bg)`, borderLeft: `3px solid var(--${strong})` }}
    >
      <span className="font-mono font-bold shrink-0" style={{ color: `var(--${strong})` }}>{e.id}</span>
      <span className="truncate" style={{ color: 'var(--text2)' }}>{e.title}</span>
    </button>
  );
}

function EventRow({ e, onClick }: { e: CalEvent; onClick: (e: CalEvent) => void }) {
  const tone = layerTone(e.layer);
  return (
    <button onClick={() => onClick(e)} className="w-full flex items-center gap-3 px-4 py-2.5 text-left risk-row">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `var(--${tone})` }} />
      <span className="font-mono text-[11px] font-bold w-16 shrink-0" style={{ color: `var(--${tone})` }}>{e.id}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--text)' }}>{e.title}</span>
        <span className="block text-[11px]" style={{ color: 'var(--text3)' }}>{layerLabel(e.layer)}</span>
      </span>
      {e.status === 'Overdue'
        ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>Overdue {e.overdueDays}d</span>
        : <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--text2)' }}>{fmtLong(e.date)}</span>}
      <span style={{ color: 'var(--text3)' }}>→</span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function MasterCalendarPage() {
  const store = useStore();
  const { navigate } = useNav();

  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date(`${todayIso()}T00:00:00`));
  const [layers, setLayers] = useState<Set<LayerKey>>(() => new Set(LAYERS.map((l) => l.key)));
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [external, setExternal] = useState(readExternal);
  const [syncedAt, setSyncedAt] = useState<Date>(() => new Date());
  const [syncing, setSyncing] = useState(false);

  const events = useMemo(() => {
    const data: CalData = { treatments: store.treatments, risks: store.risks, ...external };
    return buildCalendarEvents(data);
  }, [store.treatments, store.risks, external]);

  const eventsF = useMemo(() => events.filter((e) => layers.has(e.layer)), [events, layers]);
  const grouped = useMemo(() => byDate(eventsF), [eventsF]);
  const overdue = useMemo(() => eventsF.filter((e) => e.status === 'Overdue').sort((a, b) => b.overdueDays - a.overdueDays), [eventsF]);

  const toggleLayer = (k: LayerKey) =>
    setLayers((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const resync = () => {
    setSyncing(true);
    setExternal(readExternal());
    setSyncedAt(new Date());
    window.setTimeout(() => setSyncing(false), 650);
  };

  const shift = (dir: 1 | -1) =>
    setCursor((c) => {
      const d = new Date(c);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'week') d.setDate(d.getDate() + 7 * dir);
      else d.setDate(d.getDate() + dir);
      return d;
    });

  const openDay = (dateIso: string) => { setCursor(new Date(`${dateIso}T00:00:00`)); setView('day'); };

  const weekTitle = () => {
    const cells = weekCells(cursor);
    const a = new Date(`${cells[0].date}T00:00:00`);
    const b = new Date(`${cells[6].date}T00:00:00`);
    const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${f(a)} – ${f(b)}`;
  };
  const dated = view !== 'agenda';
  const title =
    view === 'month' ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
      : view === 'week' ? weekTitle()
        : view === 'day' ? cursor.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
          : 'Upcoming Schedule';

  const allLayers = () => setLayers(new Set(LAYERS.map((l) => l.key)));
  // Clicking a dashboard category focuses the calendar on that layer (click again = all).
  const focusLayer = (l: LayerKey) =>
    setLayers((prev) => (prev.size === 1 && prev.has(l) ? new Set(LAYERS.map((x) => x.key)) : new Set([l])));

  return (
    <>
      <PageHeader>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ok)' }} />
          Last synchronized: {relTime(syncedAt)}
        </span>
        <button onClick={resync} className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text2)', background: 'var(--surface)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? 'animate-spin' : ''}><path d="M3 2v6h6" /><path d="M3.5 12a9 9 0 1 0 2.6-6.4L3 8" /></svg>
          Force Re-Sync
        </button>
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* Always-on deadline dashboard — stands above the calendar, visible in every view */}
        <CalendarDashboard events={events} onFocusLayer={focusLayer} onAgenda={() => setView('agenda')} activeLayers={layers} />

        {/* Control row */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {dated && (
              <>
                <button onClick={() => shift(-1)} aria-label="Previous" className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>‹</button>
                <button onClick={() => shift(1)} aria-label="Next" className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>›</button>
              </>
            )}
            <div className="text-[17px] font-bold px-2" style={{ color: 'var(--text)' }}>{title}</div>
            {dated && <button onClick={() => setCursor(new Date(`${todayIso()}T00:00:00`))} className="text-[12.5px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--accent)' }}>Today</button>}
          </div>
          <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {([['month', 'Month'], ['week', 'Week'], ['day', 'Day'], ['agenda', 'Agenda List']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-md text-[13px] font-semibold transition-colors"
                style={view === v ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text2)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar (layer filters) + main calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-[264px_1fr] gap-4 items-start">
          {/* Sidebar */}
          <div className="space-y-4">
            <div className="section-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>Service Layers</h3>
                {layers.size < LAYERS.length && (
                  <button onClick={allLayers} className="text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>Show all</button>
                )}
              </div>
              <div className="space-y-2.5">
                {LAYERS.map((l) => (
                  <label key={l.key} className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={layers.has(l.key)} onChange={() => toggleLayer(l.key)} className="mt-0.5 w-4 h-4 rounded" style={{ accentColor: `var(--${l.tone})` }} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `var(--${l.tone})` }} />
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{l.label}</span>
                      </span>
                      <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>{l.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="section-card overflow-hidden">
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-[13px] font-bold" style={{ color: 'var(--crit)' }}>Critical Overdue ({overdue.length})</h3>
              </div>
              {overdue.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'var(--text3)' }}>Nothing overdue. 🎉</div>
              ) : (
                <>
                  <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {overdue.slice(0, 4).map((e) => (
                      <button key={e.id} onClick={() => setSelected(e)} className="w-full text-left px-4 py-3 risk-row flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-[11px] font-bold" style={{ color: 'var(--text2)' }}>{e.id}</span>
                          <span className="block text-[12px] mt-0.5 truncate" style={{ color: 'var(--text)' }} title={e.title}>{e.title}</span>
                          <span className="inline-block mt-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>Overdue {e.overdueDays} days</span>
                        </span>
                        <span style={{ color: 'var(--text3)' }}>→</span>
                      </button>
                    ))}
                  </div>
                  {overdue.length > 4 && (
                    <button onClick={() => setView('agenda')} className="w-full text-left px-4 py-2.5 text-[12px] font-semibold border-t hover:opacity-80" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>View all overdues →</button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main view */}
          <div className="section-card p-3 min-w-0">
            {view === 'month' && <MonthView cursorMonth={cursor} grouped={grouped} onEvent={setSelected} onMore={openDay} />}
            {view === 'week' && <WeekView cursor={cursor} grouped={grouped} onEvent={setSelected} />}
            {view === 'day' && <DayView cursor={cursor} events={grouped.get(iso(cursor)) ?? []} onEvent={setSelected} />}
            {view === 'agenda' && <AgendaView events={eventsF} onEvent={setSelected} />}
          </div>
        </div>
      </div>

      {selected && (
        <Modal open onClose={() => setSelected(null)} title={selected.title} subtitle={`${selected.id} · ${selected.type}`} maxWidth="max-w-lg">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Source"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--${layerTone(selected.layer)})` }} />{selected.source}</span></Field>
              <Field label="Due date">{fmtLong(selected.date)}</Field>
              <Field label="Owner team">{selected.owner}</Field>
              <Field label="Status">
                {selected.status === 'Overdue'
                  ? <span className="font-semibold" style={{ color: 'var(--crit)' }}>Overdue {selected.overdueDays} days</span>
                  : <span style={{ color: selected.status === 'Done' ? 'var(--ok)' : 'var(--text)' }}>{selected.status}</span>}
              </Field>
              <Field label="Criticality">
                {selected.criticality === '—'
                  ? <span style={{ color: 'var(--text3)' }}>—</span>
                  : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `var(--${critTone(selected.criticality)}-bg)`, color: `var(--${critTone(selected.criticality)})` }}>{selected.criticality}</span>}
              </Field>
              <Field label="Type">{selected.type}</Field>
            </div>
            {selected.description && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Description</div>
                <p className="text-[13px]" style={{ color: 'var(--text2)' }}>{selected.description}</p>
              </div>
            )}
            <button
              onClick={() => { const m = selected.moduleId; setSelected(null); navigate(m); }}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Go to Service Module →
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="text-[13px]" style={{ color: 'var(--text)' }}>{children}</div>
    </div>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────
function MonthView({ cursorMonth, grouped, onEvent, onMore }: { cursorMonth: Date; grouped: Map<string, CalEvent[]>; onEvent: (e: CalEvent) => void; onMore: (date: string) => void }) {
  const cells = monthCells(cursorMonth.getFullYear(), cursorMonth.getMonth());
  return (
    <div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[11px] font-bold uppercase tracking-wider py-2" style={{ color: 'var(--text3)' }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const evs = grouped.get(c.date) ?? [];
          return (
            <div
              key={c.date}
              className="min-h-[96px] rounded-lg border p-1 flex flex-col gap-1"
              style={{ borderColor: 'var(--border)', background: c.inMonth ? 'var(--surface)' : 'var(--surface2)', opacity: c.inMonth ? 1 : 0.6 }}
            >
              <div className="flex justify-end">
                {c.isToday
                  ? <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>{c.day}</span>
                  : <span className="text-[12px] font-semibold px-1" style={{ color: c.inMonth ? 'var(--text2)' : 'var(--text3)' }}>{c.day}</span>}
              </div>
              {evs.slice(0, 3).map((e) => <Chip key={e.id} e={e} onClick={onEvent} />)}
              {evs.length > 3 && (
                <button onClick={() => onMore(c.date)} className="text-[10.5px] font-semibold text-left px-1 hover:underline" style={{ color: 'var(--accent)' }}>+ {evs.length - 3} more</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, grouped, onEvent }: { cursor: Date; grouped: Map<string, CalEvent[]>; onEvent: (e: CalEvent) => void }) {
  const cells = weekCells(cursor);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {cells.map((c) => {
        const evs = grouped.get(c.date) ?? [];
        const d = new Date(`${c.date}T00:00:00`);
        return (
          <div key={c.date} className="rounded-lg border p-2 min-h-[200px] flex flex-col gap-1.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="text-center pb-1.5 mb-1 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--text3)' }}>{WEEKDAYS[d.getDay()]}</div>
              {c.isToday
                ? <div className="mx-auto mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>{c.day}</div>
                : <div className="text-[15px] font-bold mt-0.5" style={{ color: 'var(--text)' }}>{c.day}</div>}
            </div>
            {evs.length === 0
              ? <div className="text-[10.5px] text-center py-2" style={{ color: 'var(--text3)' }}>—</div>
              : evs.map((e) => <Chip key={e.id} e={e} onClick={onEvent} />)}
          </div>
        );
      })}
    </div>
  );
}

function DayView({ cursor, events, onEvent }: { cursor: Date; events: CalEvent[]; onEvent: (e: CalEvent) => void }) {
  return (
    <div>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        <span className="text-[12px]" style={{ color: 'var(--text3)' }}>{events.length} item{events.length !== 1 ? 's' : ''}</span>
      </div>
      {events.length === 0
        ? <div className="px-4 py-16 text-center text-sm" style={{ color: 'var(--text3)' }}>No deadlines on this day.</div>
        : <div className="divide-y" style={{ borderColor: 'var(--border)' }}>{events.map((e) => <EventRow key={e.id} e={e} onClick={onEvent} />)}</div>}
    </div>
  );
}

function AgendaView({ events, onEvent }: { events: CalEvent[]; onEvent: (e: CalEvent) => void }) {
  const buckets = agendaBuckets(events);
  if (buckets.length === 0) return <div className="px-4 py-16 text-center text-sm" style={{ color: 'var(--text3)' }}>Nothing scheduled.</div>;
  return (
    <div>
      {buckets.map((b) => (
        <div key={b.key}>
          <div className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider sticky top-0" style={{ color: b.key === 'overdue' ? 'var(--crit)' : 'var(--text3)', background: 'var(--surface2)' }}>
            {b.label} ({b.events.length})
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {b.events.map((e) => <EventRow key={e.id} e={e} onClick={onEvent} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dashboard view ───────────────────────────────────────────────────────────
function StatTile({ label, value, tone, onClick }: { label: string; value: number; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="section-card p-4 text-left flex flex-col gap-1 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <span className="text-[28px] font-bold tabular-nums leading-none" style={{ color: `var(--${tone})` }}>{value}</span>
      <span className="text-[12px] mt-1" style={{ color: 'var(--text3)' }}>{label}</span>
    </button>
  );
}

function CatBar({ label, tone, value, max, active, onClick }: { label: string; tone: string; value: number; max: number; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="w-full flex items-center gap-3 text-[12px] disabled:cursor-default group">
      <span className="w-24 shrink-0 text-right truncate" style={{ color: active ? 'var(--accent)' : 'var(--text2)', fontWeight: active ? 700 : 400 }} title={label}>{label}</span>
      <span className="flex-1 h-4 rounded-md overflow-hidden" style={{ background: 'var(--surface3)', outline: active ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
        <span className="block h-full rounded-md transition-all group-hover:brightness-95" style={{ width: `${Math.max(value > 0 ? 8 : 0, (value / max) * 100)}%`, background: `var(--${tone})` }} />
      </span>
      <span className="w-6 text-right font-bold tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
    </button>
  );
}

function DashCard({ title, hint, flush, children }: { title: string; hint?: string; flush?: boolean; children: ReactNode }) {
  return (
    <div className="section-card overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
        {hint && <span className="text-[11px]" style={{ color: 'var(--text3)' }}>{hint}</span>}
      </div>
      <div className={flush ? 'flex-1' : 'flex-1 flex flex-col justify-center p-4 space-y-2.5'}>{children}</div>
    </div>
  );
}

const NoneRow = ({ label }: { label: string }) => <div className="py-6 text-center text-[12px]" style={{ color: 'var(--text3)' }}>{label}</div>;

function CalendarDashboard({
  events,
  onFocusLayer,
  onAgenda,
  activeLayers,
}: {
  events: CalEvent[];
  onFocusLayer: (l: LayerKey) => void;
  onAgenda: () => void;
  activeLayers: Set<LayerKey>;
}) {
  const t = new Date(`${todayIso()}T00:00:00`);
  const endOfWeek = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + (6 - t.getDay())));
  const endOfMonth = iso(new Date(t.getFullYear(), t.getMonth() + 1, 0));
  const in90 = iso(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 90));

  const overdue = events.filter((e) => e.status === 'Overdue');
  const upcoming = events.filter((e) => e.status === 'Upcoming');
  const dueWeek = upcoming.filter((e) => e.date <= endOfWeek).length;
  const dueMonth = upcoming.filter((e) => e.date <= endOfMonth).length;
  const up90 = upcoming.filter((e) => e.date <= in90);

  const catOverdue = LAYERS.map((l) => ({ l, n: overdue.filter((e) => e.layer === l.key).length }));
  const catUpcoming = LAYERS.map((l) => ({ l, n: up90.filter((e) => e.layer === l.key).length }));
  const maxOverdue = Math.max(1, ...catOverdue.map((c) => c.n));
  const maxUpcoming = Math.max(1, ...catUpcoming.map((c) => c.n));
  const isFocused = (k: LayerKey) => activeLayers.size === 1 && activeLayers.has(k);

  const ages: { label: string; tone: string; n: number }[] = [
    { label: '≤ 7 days', tone: 'med', n: overdue.filter((e) => e.overdueDays <= 7).length },
    { label: '8–30 days', tone: 'high', n: overdue.filter((e) => e.overdueDays > 7 && e.overdueDays <= 30).length },
    { label: '30+ days', tone: 'crit', n: overdue.filter((e) => e.overdueDays > 30).length },
  ];
  const maxAge = Math.max(1, ...ages.map((a) => a.n));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Overdue" value={overdue.length} tone="crit" onClick={onAgenda} />
        <StatTile label="Due this week" value={dueWeek} tone="high" onClick={onAgenda} />
        <StatTile label="Due this month" value={dueMonth} tone="info" onClick={onAgenda} />
        <StatTile label="Upcoming · next 90 days" value={up90.length} tone="ok" onClick={onAgenda} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DashCard title="Overdue by category" hint="Click to filter">
          {overdue.length === 0 ? <NoneRow label="Nothing overdue. 🎉" /> : catOverdue.map((c) => (
            <CatBar key={c.l.key} label={c.l.label} tone={c.l.tone} value={c.n} max={maxOverdue} active={isFocused(c.l.key)} onClick={() => onFocusLayer(c.l.key)} />
          ))}
        </DashCard>

        <DashCard title="Overdue by age" hint="Oldest first">
          {overdue.length === 0 ? <NoneRow label="No overdue items." /> : ages.map((a) => (
            <CatBar key={a.label} label={a.label} tone={a.tone} value={a.n} max={maxAge} onClick={onAgenda} />
          ))}
        </DashCard>

        <DashCard title="Upcoming by category" hint="Next 90 days · click to filter">
          {up90.length === 0 ? <NoneRow label="Nothing scheduled." /> : catUpcoming.map((c) => (
            <CatBar key={c.l.key} label={c.l.label} tone={c.l.tone} value={c.n} max={maxUpcoming} active={isFocused(c.l.key)} onClick={() => onFocusLayer(c.l.key)} />
          ))}
        </DashCard>
      </div>
    </div>
  );
}
