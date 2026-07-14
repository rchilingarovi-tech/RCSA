import { useMemo } from 'react';
import {
  SEVERITIES,
  INCIDENT_STATUSES,
  CATEGORIES,
  severityColor,
  statusColor,
  isOpen,
  timeToClosureDays,
  type Incident,
} from './types';

type Seg = { label: string; value: number; k: string };

// ── Donut (hand-rolled SVG, theme-token colours) ────────────────────────────────
function Donut({ segments, centerTop, centerBottom }: { segments: Seg[]; centerTop: string; centerBottom: string }) {
  const size = 128, stroke = 16, r = (size - stroke) / 2, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: '0 0 auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s, i) => {
            const len = (s.value / sum) * C;
            const gap = s.value ? 2 : 0;
            const el = (
              <circle
                key={i}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={`var(--${s.k})`} strokeWidth={stroke}
                strokeDasharray={`${Math.max(len - gap, 0)} ${C - Math.max(len - gap, 0)}`}
                strokeDashoffset={-acc} strokeLinecap="round"
              />
            );
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="tabular-nums" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: 'var(--text)' }}>{centerTop}</div>
        <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text3)', marginTop: 2 }}>{centerBottom}</div>
      </div>
    </div>
  );
}

function DonutCard({ title, subtitle, segments, centerTop, centerBottom }: { title: string; subtitle: string; segments: Seg[]; centerTop: string; centerBottom: string }) {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="section-card p-5">
      <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h3>
      <p className="text-xs mb-3" style={{ color: 'var(--text3)' }}>{subtitle}</p>
      <div className="flex items-center gap-6">
        <Donut segments={segments} centerTop={centerTop} centerBottom={centerBottom} />
        <div className="flex-1 flex flex-col gap-2.5 min-w-0">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2.5">
              <span style={{ width: 9, height: 9, borderRadius: 3, background: `var(--${s.k})`, flex: '0 0 auto' }} />
              <span className="text-[13.5px] flex-1 truncate" style={{ color: 'var(--text2)' }}>{s.label}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{s.value}</span>
              <span className="text-[11px] tabular-nums" style={{ color: 'var(--text3)', width: 38, textAlign: 'right' }}>{Math.round(s.value / sum * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Area/line trend (hand-rolled SVG) ───────────────────────────────────────────
function AreaChart({ points }: { points: number[] }) {
  const W = 620, H = 200, padL = 16, padR = 16, padT = 12, padB = 8;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(4, ...points);
  const co: [number, number][] = points.map((v, i) => [
    padL + (points.length > 1 ? (i / (points.length - 1)) : 0) * iw,
    padT + ih - (v / max) * ih,
  ]);
  const line = 'M' + co.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' L');
  const area = `${line} L${co[co.length - 1][0].toFixed(1)},${padT + ih} L${co[0][0].toFixed(1)},${padT + ih} Z`;
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((g) => padT + ih - g * ih);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="incTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {gridY.map((y, i) => <line key={i} x1={padL} y1={y} x2={padL + iw} y2={y} stroke="var(--border)" strokeWidth={1} />)}
      <path d={area} fill="url(#incTrendFill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {co.map((c, i) => <circle key={i} cx={c[0]} cy={c[1]} r={i === co.length - 1 ? 4 : 3} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2} />)}
    </svg>
  );
}

const KPI_COLOR = ['var(--high)', 'var(--crit)', 'var(--info)', 'var(--accent)'];

export function IncidentsDashboard({ incidents }: { incidents: Incident[] }) {
  const kpis = useMemo(() => {
    const open = incidents.filter(isOpen).length;
    const critHigh = incidents.filter((i) => i.severity === 'Critical' || i.severity === 'High').length;
    const d = new Date();
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const thisMonth = incidents.filter((i) => new Date(i.reportedAt).getTime() >= monthStart).length;
    const closures = incidents.map(timeToClosureDays).filter((n): n is number => n != null);
    const avg = closures.length ? Math.round(closures.reduce((s, n) => s + n, 0) / closures.length) : null;
    return [
      { label: 'Open Incidents', value: String(open), unit: '' },
      { label: 'Critical / High', value: String(critHigh), unit: '' },
      { label: 'Reported This Month', value: String(thisMonth), unit: '' },
      { label: 'Avg Time to Closure', value: avg == null ? '—' : String(avg), unit: avg == null ? '' : 'd' },
    ];
  }, [incidents]);

  const total = incidents.length;
  const closedCount = incidents.filter((i) => i.status === 'Closed').length;

  const severitySeg = useMemo<Seg[]>(
    () => SEVERITIES.map((s) => ({ label: s, value: incidents.filter((i) => i.severity === s).length, k: severityColor(s) })),
    [incidents],
  );
  const statusSeg = useMemo<Seg[]>(
    () => INCIDENT_STATUSES.map((s) => ({ label: s, value: incidents.filter((i) => i.status === s).length, k: statusColor(s) })),
    [incidents],
  );
  const categoryBars = useMemo(() => {
    const rows = CATEGORIES.map((c) => ({ label: c, value: incidents.filter((i) => i.category === c).length }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const max = Math.max(1, ...rows.map((r) => r.value));
    return { rows, max };
  }, [incidents]);

  const trend = useMemo(() => {
    const base = new Date();
    const buckets: number[] = [];
    const labels: string[] = [];
    for (let k = 5; k >= 0; k--) {
      const start = new Date(base.getFullYear(), base.getMonth() - k, 1);
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      buckets.push(incidents.filter((i) => { const t = new Date(i.reportedAt); return t >= start && t < next; }).length);
      labels.push(start.toLocaleString(undefined, { month: 'short' }));
    }
    const first = buckets[0], last = buckets[buckets.length - 1];
    const change = first > 0 ? Math.round(((last - first) / first) * 100) : null;
    return { buckets, labels, change, firstLabel: labels[0] };
  }, [incidents]);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
        {kpis.map((k, i) => (
          <div key={k.label} className="section-card relative overflow-hidden p-4">
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: KPI_COLOR[i] }} />
            <div className="text-[12px] mb-2" style={{ color: 'var(--text3)' }}>{k.label}</div>
            <div className="tabular-nums" style={{ fontSize: 32, fontWeight: 700, lineHeight: 0.9, color: 'var(--text)' }}>
              {k.value}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>{k.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Severity + Status donuts */}
      <div className="grid gap-4 md:grid-cols-2">
        <DonutCard title="By Severity" subtitle="Distribution across incidents in scope" segments={severitySeg} centerTop={String(total)} centerBottom="total" />
        <DonutCard title="By Status" subtitle="Where incidents sit in the pipeline" segments={statusSeg} centerTop={total ? `${Math.round(closedCount / total * 100)}%` : '—'} centerBottom="closed" />
      </div>

      {/* Category bars + Trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="section-card p-5">
          <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>By Category</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text3)' }}>Attack-surface breakdown</p>
          <div className="flex flex-col gap-3.5">
            {categoryBars.rows.length === 0 ? (
              <span className="text-sm" style={{ color: 'var(--text3)' }}>No incidents in scope.</span>
            ) : categoryBars.rows.map((c) => (
              <div key={c.label} className="flex items-center gap-3.5">
                <span className="text-[13px] flex-shrink-0 truncate" style={{ color: 'var(--text2)', width: 130 }}>{c.label}</span>
                <div className="flex-1 h-2.5 rounded-md overflow-hidden" style={{ background: 'var(--surface3)' }}>
                  <div className="h-full rounded-md" style={{ width: `${(c.value / categoryBars.max) * 100}%`, background: 'linear-gradient(90deg, var(--info), var(--accent))', minWidth: 6 }} />
                </div>
                <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: 'var(--text)', width: 16, textAlign: 'right' }}>{c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Reported over time</h3>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Last 6 months</p>
            </div>
            {trend.change != null && (
              <div className="text-right">
                <div className="tabular-nums text-[20px] font-bold" style={{ color: trend.change >= 0 ? 'var(--crit)' : 'var(--low)' }}>
                  {trend.change >= 0 ? '+' : ''}{trend.change}%
                </div>
                <div className="text-[11px]" style={{ color: 'var(--text3)' }}>vs {trend.firstLabel}</div>
              </div>
            )}
          </div>
          <div className="mt-3">
            <AreaChart points={trend.buckets} />
            <div className="flex justify-between mt-1.5">
              {trend.labels.map((l, i) => <span key={i} className="text-[10px]" style={{ color: 'var(--text3)' }}>{l}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
