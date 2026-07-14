import type { ReactNode } from 'react';
import { Icon } from '../../components/common/Icon';
import { Pill } from '../../components/common/Pill';
import type {
  AttentionItem,
  DeptDist,
  Level,
  OverdueTreatmentRow,
  Priority,
  TopResidual,
  UpcomingItem,
} from './aggregate';

export const levelTone: Record<Level, string> = { Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' };
export const priorityTone: Record<Priority, string> = { Critical: 'crit', High: 'high', Medium: 'med' };

const MODULE_ICON: Record<string, string> = {
  'treatment-catalogue': 'tool',
  incidents: 'bolt',
  'risk-catalogue': 'shield',
  'access-reviews': 'key',
  vendors: 'building',
  policies: 'doc',
  kpis: 'chart',
  awareness: 'grad',
  findings: 'edit',
  vulns: 'alert',
};

const fmtDate = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
};

// ── Generic panel with title + optional footer link ──────────────────────────
export function Panel({
  title,
  meta,
  footer,
  onFooter,
  children,
  className,
  center,
}: {
  title: string;
  meta?: ReactNode;
  footer?: string;
  onFooter?: () => void;
  children: ReactNode;
  className?: string;
  /** Vertically center content (for charts) so it fills a stretched card; tables keep top-align. */
  center?: boolean;
}) {
  return (
    <div className={`section-card flex flex-col overflow-hidden h-full ${className ?? ''}`}>
      <div className="px-5 py-3 border-b flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        {meta != null && <span className="text-xs" style={{ color: 'var(--text3)' }}>{meta}</span>}
      </div>
      <div className={`flex-1 min-h-0 ${center ? 'flex flex-col justify-center' : ''}`}>{children}</div>
      {footer && (
        <button
          onClick={onFooter}
          className="px-5 py-2.5 text-left text-[12.5px] font-semibold border-t transition-colors hover:opacity-80"
          style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}
        >
          {footer} →
        </button>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
export function KpiCard({
  icon,
  tone,
  title,
  value,
  sub,
  delta,
  higherIsBetter,
  periodLabel,
  linkLabel,
  onClick,
}: {
  icon: string;
  tone: string;
  title: string;
  value: string;
  sub: string;
  delta: number | null;
  higherIsBetter: boolean;
  periodLabel: string;
  linkLabel: string;
  onClick: () => void;
}) {
  const arrow = delta == null ? '' : delta > 0 ? '↑' : delta < 0 ? '↓' : '–';
  const deltaTone = delta == null || delta === 0 ? 'mut' : delta > 0 === higherIsBetter ? 'low' : 'crit';
  return (
    <button
      onClick={onClick}
      className="section-card p-5 h-full text-left flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>
          <Icon name={icon} size={20} />
        </span>
        <span className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text2)' }}>{title}</span>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-bold tabular-nums leading-none" style={{ color: 'var(--text)' }}>{value}</span>
          {delta != null && (
            <span className="text-[13px] font-bold tabular-nums" title={`vs previous · ${periodLabel}`} style={{ color: `var(--${deltaTone})` }}>
              {arrow} {Math.abs(delta)}
            </span>
          )}
        </div>
        <div className="text-[12px] mt-1.5 truncate" style={{ color: 'var(--text3)' }}>{sub}</div>
      </div>
      <div className="text-[12.5px] font-semibold mt-auto" style={{ color: 'var(--accent)' }}>{linkLabel} →</div>
    </button>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
export interface DashFilters {
  dept: string;
  crit: string;
  level: string;
  status: string;
  range: string;
}
export const DEFAULT_FILTERS: DashFilters = { dept: '', crit: '', level: '', status: '', range: '30' };

function Select({
  value,
  onChange,
  options,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  icon?: string;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }}>
          <Icon name={icon} size={14} />
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none border rounded-lg py-2 pr-8 text-[13px] font-medium ${icon ? 'pl-8' : 'pl-3'}`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text2)' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[10px]" style={{ color: 'var(--text3)' }}>▼</span>
    </div>
  );
}

export function FilterBar({
  filters,
  setFilters,
  departments,
}: {
  filters: DashFilters;
  setFilters: (f: DashFilters) => void;
  departments: string[];
}) {
  const set = (patch: Partial<DashFilters>) => setFilters({ ...filters, ...patch });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select icon="calendar" value={filters.range} onChange={(v) => set({ range: v })} options={[
        { value: '30', label: 'Next 30 days' },
        { value: '60', label: 'Next 60 days' },
        { value: '90', label: 'Next 90 days' },
        { value: 'all', label: 'All time' },
      ]} />
      <Select value={filters.dept} onChange={(v) => set({ dept: v })} options={[
        { value: '', label: 'All departments' },
        ...departments.map((d) => ({ value: d, label: d })),
      ]} />
      <Select value={filters.crit} onChange={(v) => set({ crit: v })} options={[
        { value: '', label: 'All criticality' },
        { value: 'High', label: 'High criticality' },
        { value: 'Medium', label: 'Medium criticality' },
        { value: 'Low', label: 'Low criticality' },
      ]} />
      <Select value={filters.level} onChange={(v) => set({ level: v })} options={[
        { value: '', label: 'All risk levels' },
        { value: 'Critical', label: 'Critical' },
        { value: 'High', label: 'High' },
        { value: 'Medium', label: 'Medium' },
        { value: 'Low', label: 'Low' },
      ]} />
      <Select value={filters.status} onChange={(v) => set({ status: v })} options={[
        { value: '', label: 'All statuses' },
        { value: 'Open', label: 'Open' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Overdue', label: 'Overdue' },
      ]} />
      <div className="flex-1" />
      {!isDefault && (
        <button onClick={() => setFilters(DEFAULT_FILTERS)} className="flex items-center gap-1.5 text-[12.5px] font-semibold px-2 py-1 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6" /><path d="M3.5 12a9 9 0 1 0 2.6-6.4L3 8" /></svg>
          Reset filters
        </button>
      )}
    </div>
  );
}

// ── CISO attention items table ───────────────────────────────────────────────
export function AttentionTable({ items, onOpen }: { items: AttentionItem[]; onOpen: (moduleId: string) => void }) {
  if (items.length === 0) return <Empty label="No urgent attention items — nothing overdue or off track." />;
  const th = 'text-left px-2 py-2 text-[10px] font-bold uppercase tracking-wider';
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead style={{ color: 'var(--text3)' }}>
          <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
            <th className={`${th} pl-5`}>Priority</th>
            <th className={th}>Item</th>
            <th className={th}>Source</th>
            <th className={th}>Owner</th>
            <th className={`${th} pr-5 text-right`}>Due date</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {items.map((it) => {
            const tone = priorityTone[it.priority];
            return (
              <tr key={it.id} onClick={() => onOpen(it.moduleId)} className="risk-row cursor-pointer">
                <td className="pl-5 pr-2 py-2.5 w-px"><Pill text={it.priority} k={tone} /></td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0" style={{ color: `var(--${tone})` }}><Icon name={MODULE_ICON[it.moduleId] ?? 'alert'} size={15} /></span>
                    <span className="font-medium truncate max-w-[220px]" style={{ color: 'var(--text)' }} title={it.label}>{it.label}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5"><span className="font-mono text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{it.source}</span></td>
                <td className="px-2 py-2.5 text-[12px] whitespace-nowrap" style={{ color: 'var(--text2)' }}>{it.owner}</td>
                <td className="pl-2 pr-5 py-2.5 text-right whitespace-nowrap">
                  {it.overdueDays && it.overdueDays > 0
                    ? <span className="text-[12px] font-bold" style={{ color: 'var(--crit)' }}>Overdue {it.overdueDays}d</span>
                    : it.due
                      ? <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{fmtDate(it.due)}</span>
                      : <span className="text-[12px]" style={{ color: 'var(--text3)' }}>Open</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Residual heat map (5×5) ──────────────────────────────────────────────────
const cellTone = (score: number): string => (score <= 4 ? 'low' : score <= 9 ? 'med' : score <= 14 ? 'high' : 'crit');

export function ResidualHeatmap({ matrix }: { matrix: number[][] }) {
  const impacts = [5, 4, 3, 2, 1]; // top → bottom
  const likelihoods = [1, 2, 3, 4, 5];
  return (
    <div className="p-4">
      <div className="flex gap-2">
        {/* Y axis label */}
        <div className="flex items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text3)' }}>Impact</span>
        </div>
        <div className="flex-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
            {impacts.map((imp) => (
              <div key={imp} className="contents">
                <div className="flex items-center justify-center text-[11px] font-semibold pr-1" style={{ color: 'var(--text3)' }}>{imp}</div>
                {likelihoods.map((lik) => {
                  const count = matrix[imp - 1][lik - 1];
                  const tone = cellTone(imp * lik);
                  return (
                    <div
                      key={lik}
                      className="aspect-square rounded-md flex items-center justify-center text-[14px] font-bold tabular-nums text-white transition-transform hover:scale-105"
                      title={`Impact ${imp} × Likelihood ${lik}: ${count} residual risk${count === 1 ? '' : 's'}`}
                      style={{ background: `var(--${tone})` }}
                    >
                      {count}
                    </div>
                  );
                })}
              </div>
            ))}
            {/* X axis numbers */}
            <div />
            {likelihoods.map((lik) => (
              <div key={lik} className="text-center text-[11px] font-semibold pt-1" style={{ color: 'var(--text3)' }}>{lik}</div>
            ))}
          </div>
          <div className="text-center text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: 'var(--text3)' }}>Likelihood</div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
        {(['low', 'med', 'high', 'crit'] as const).map((t, i) => (
          <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text3)' }}>
            <span className="w-3 h-3 rounded" style={{ background: `var(--${t})` }} />
            {['Low', 'Medium', 'High', 'Critical'][i]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Risks by department (stacked bars) ───────────────────────────────────────
export function DeptBars({ rows }: { rows: DeptDist[] }) {
  if (rows.length === 0) return <Empty label="No risks match the current filters." />;
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="p-4 flex flex-col gap-2.5">
      {rows.map((r) => {
        const segs: [number, string][] = [[r.critical, 'crit'], [r.high, 'high'], [r.medlow, 'low']];
        return (
          <div key={r.dept} className="flex items-center gap-3 text-[12px]">
            <span className="w-28 shrink-0 text-right truncate" style={{ color: 'var(--text2)' }} title={r.dept}>{r.dept}</span>
            <span className="flex-1 h-5 rounded-md flex" style={{ background: 'var(--surface3)' }}>
              <span className="h-full flex rounded-md overflow-hidden" style={{ width: `${(r.total / max) * 100}%` }}>
                {segs.filter(([v]) => v > 0).map(([v, tone], i) => (
                  <span
                    key={i}
                    className="h-full flex items-center justify-center text-[10px] font-bold text-white tabular-nums"
                    style={{ width: `${(v / r.total) * 100}%`, background: `var(--${tone})` }}
                  >
                    {v}
                  </span>
                ))}
              </span>
            </span>
            <span className="w-6 text-right font-bold tabular-nums" style={{ color: 'var(--text)' }}>{r.total}</span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 mt-1 flex-wrap">
        {[['crit', 'Critical'], ['high', 'High'], ['low', 'Medium / Low']].map(([t, l]) => (
          <span key={t} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text3)' }}>
            <span className="w-3 h-3 rounded" style={{ background: `var(--${t})` }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Top residual risks ───────────────────────────────────────────────────────
const TrendArrow = ({ trend }: { trend: TopResidual['trend'] }) => {
  const map = { up: { c: 'crit', s: '↑' }, down: { c: 'low', s: '↓' }, flat: { c: 'mut', s: '→' } } as const;
  const { c, s } = map[trend];
  return <span className="font-bold" title={trend === 'up' ? 'Worse than inherent' : trend === 'down' ? 'Improved vs inherent' : 'No change vs inherent'} style={{ color: `var(--${c})` }}>{s}</span>;
};

export function TopResidualTable({ rows, onOpen }: { rows: TopResidual[]; onOpen: () => void }) {
  if (rows.length === 0) return <Empty label="No residual risks assessed yet." />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r) => (
            <tr key={r.id} onClick={onOpen} className="risk-row cursor-pointer">
              <td className="pl-5 pr-2 py-2.5 font-mono text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>{r.id}</td>
              <td className="px-2 py-2.5 font-mono text-[11px]" style={{ color: 'var(--text3)' }}>{r.assetId}</td>
              <td className="px-2 py-2.5"><Pill text={`${r.score} · ${r.level}`} k={levelTone[r.level]} /></td>
              <td className="pl-2 pr-5 py-2.5 text-right text-[15px]"><TrendArrow trend={r.trend} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Overdue treatments ───────────────────────────────────────────────────────
export function OverdueTable({ rows, onOpen }: { rows: OverdueTreatmentRow[]; onOpen: () => void }) {
  if (rows.length === 0) return <Empty label="No overdue treatments. 🎉" />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r) => (
            <tr key={r.id} onClick={onOpen} className="risk-row cursor-pointer">
              <td className="pl-5 pr-2 py-2.5 font-mono text-[11px] font-semibold" style={{ color: 'var(--accent)' }}>{r.id}</td>
              <td className="px-2 py-2.5 font-mono text-[11px]" style={{ color: 'var(--text3)' }}>{r.riskId}</td>
              <td className="px-2 py-2.5 text-[12px]" style={{ color: 'var(--text2)' }}>{r.due || '—'}</td>
              <td className="pl-2 pr-5 py-2.5 text-right font-bold text-[12px]" style={{ color: 'var(--crit)' }}>{r.overdueDays}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Upcoming reviews & deadlines ─────────────────────────────────────────────
const dateTone = (days: number): string => (days < 0 ? 'crit' : days <= 14 ? 'high' : days <= 30 ? 'med' : days <= 90 ? 'info' : 'mut');
const dateLabel = (days: number): string => (days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`);

export function UpcomingList({ items, onOpen }: { items: UpcomingItem[]; onOpen: (moduleId: string) => void }) {
  if (items.length === 0) return <Empty label="Nothing due in this window." />;
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {items.map((it) => {
        const tone = dateTone(it.days);
        return (
          <li key={it.id}>
            <button onClick={() => onOpen(it.moduleId)} className="w-full text-left flex items-center gap-3 px-5 py-2.5 risk-row">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>
                <Icon name={it.icon} size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold truncate" style={{ color: 'var(--text)' }}>{it.title}</span>
                <span className="block text-[11px] truncate" style={{ color: 'var(--text3)' }}>{it.subtext}</span>
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>{dateLabel(it.days)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Footer status ─────────────────────────────────────────────────────────────
export function FooterStatus({ updated }: { updated: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 text-[11.5px]" style={{ color: 'var(--text3)' }}>
      <span className="flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6" /><path d="M3.5 12a9 9 0 1 0 2.6-6.4L3 8" /></svg>
        Last updated: {updated}
      </span>
      <span className="flex items-center gap-2">
        <span>All times GMT+4</span>
        <span aria-hidden>·</span>
        <span>Data source: InfoSec Platform</span>
        <span className="w-2 h-2 rounded-full" style={{ background: 'var(--low)' }} title="Live" />
      </span>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text3)' }}>{label}</div>;
}
