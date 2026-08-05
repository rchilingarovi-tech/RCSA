import type { ReactNode } from 'react';
import { Icon } from '../../components/common/Icon';
import { Pill } from '../../components/common/Pill';
import type {
  AttentionItem,
  Priority,
  ServiceTile,
  UpcomingItem,
} from './aggregate';

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
  span: _span,
}: {
  title: string;
  meta?: ReactNode;
  footer?: string;
  onFooter?: () => void;
  children: ReactNode;
  className?: string;
  /** Vertically center content (for charts) so it fills a stretched card; tables keep top-align. */
  center?: boolean;
  /** Column span consumed by the surrounding sortable ChartGrid (not used here). */
  span?: 4 | 6 | 8 | 12;
}) {
  void _span;
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

// ── CISO attention items table ───────────────────────────────────────────────
export function AttentionTable({ items, onOpen }: { items: AttentionItem[]; onOpen: (moduleId: string, recordId?: string) => void }) {
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
              <tr key={it.id} onClick={() => onOpen(it.moduleId, it.recordId)} className="risk-row cursor-pointer">
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

// ── Upcoming reviews & deadlines ─────────────────────────────────────────────
const dateTone = (days: number): string => (days < 0 ? 'crit' : days <= 14 ? 'high' : days <= 30 ? 'med' : days <= 90 ? 'info' : 'mut');
const dateLabel = (days: number): string => (days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'Today' : `${days}d`);

export function UpcomingList({ items, onOpen }: { items: UpcomingItem[]; onOpen: (moduleId: string, recordId?: string) => void }) {
  if (items.length === 0) return <Empty label="Nothing due in this window." />;
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {items.map((it) => {
        const tone = dateTone(it.days);
        return (
          <li key={it.id}>
            <button onClick={() => onOpen(it.moduleId, it.recordId)} className="w-full text-left flex items-center gap-3 px-5 py-2.5 risk-row">
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

// ── Service health grid (one posture tile per service) ──────────────────────
export function ServiceHealthGrid({ tiles, onOpen }: { tiles: ServiceTile[]; onOpen: (moduleId: string, recordId?: string) => void }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 p-4">
      {tiles.map((t) => (
        <button
          key={t.moduleId}
          onClick={() => onOpen(t.moduleId)}
          className="rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `var(--${t.tone}-bg)`, color: `var(--${t.tone})` }}>
              <Icon name={t.icon} size={15} />
            </span>
            <span className="text-[11.5px] font-semibold truncate" style={{ color: 'var(--text2)' }}>{t.label}</span>
          </span>
          <span className="block tabular-nums text-[22px] font-bold mt-1.5 leading-none" style={{ color: `var(--${t.tone})` }}>{t.value}</span>
          <span className="block text-[11px] mt-1 truncate" title={t.sub} style={{ color: 'var(--text3)' }}>{t.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ── Generic watch list (compact id · label · pill · right-text rows) ────────
export interface WatchRow {
  id: string;
  recordId: string;
  label: string;
  pill: string;
  pillTone: string;
  right: string;
}

export function WatchList({ rows, empty, onOpen }: { rows: WatchRow[]; empty: string; onOpen: (recordId: string) => void }) {
  if (rows.length === 0) return <Empty label={empty} />;
  return (
    <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {rows.map((r) => (
        <li key={r.id}>
          <button onClick={() => onOpen(r.recordId)} className="w-full flex items-center gap-2.5 px-5 py-2.5 text-left risk-row">
            <span className="font-mono text-[11px] font-semibold shrink-0" style={{ color: 'var(--accent)' }}>{r.id}</span>
            <span className="min-w-0 flex-1 text-[12.5px] font-medium truncate" title={r.label} style={{ color: 'var(--text)' }}>{r.label}</span>
            <Pill text={r.pill} k={r.pillTone} />
            <span className="text-[11px] whitespace-nowrap w-16 text-right" style={{ color: 'var(--text3)' }}>{r.right}</span>
          </button>
        </li>
      ))}
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
