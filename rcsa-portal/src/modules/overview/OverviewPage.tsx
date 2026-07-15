import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useNav } from '../../state/NavContext';
import { usePermissions } from '../../auth/usePermissions';
import { Icon } from '../../components/common/Icon';
import { PageHeader } from '../rcsa/PageHeader';
import { auditLog } from '../../audit/auditLog';
import { incidentRepo } from '../incidents/repo';
import { SEVERITY_RANK, daysOpen, isOpen, severityColor } from '../incidents/types';
import { vendorRepo } from '../vendors/repo';
import { policyRepo } from '../policies/repo';
import { accessRepo } from '../access/repo';
import { kpiRepo } from '../kpis/repo';
import { committeeRepo } from '../committee/repo';
import { awarenessRepo } from '../awareness/repo';
import { complianceRepo } from '../compliance/repo';
import { findingsRepo } from '../findings/repo';
import { vulnRepo } from '../vulns/repo';
import {
  buildAttentionItems,
  buildUpcoming,
  headline,
  serviceHealth,
  type OverviewData,
} from './aggregate';
import { previousSnapshot, recordSnapshot } from './snapshots';
import { setIntent } from '../../lib/intent';
import {
  AttentionTable,
  FooterStatus,
  KpiCard,
  Panel,
  ServiceHealthGrid,
  UpcomingList,
  WatchList,
  type WatchRow,
} from './widgets';

// Executive overview — deliberately CROSS-SERVICE. RCSA has its own dashboard
// page, so it gets exactly one KPI card here; the rest of the page reads posture
// across every module (incidents, vulns, findings, compliance, vendors, policies,
// access, awareness, KPIs, committee).

const HIDE_KEY = 'infosec.overview.hidden';
const readHidden = (): Set<string> => {
  try {
    const raw = localStorage.getItem(HIDE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const QUICK_ACTIONS: { label: string; module: string; icon: string }[] = [
  { label: 'New incident', module: 'incidents', icon: 'bolt' },
  { label: 'New vulnerability', module: 'vulns', icon: 'alert' },
  { label: 'New finding', module: 'findings', icon: 'edit' },
  { label: 'New risk', module: 'risk-catalogue', icon: 'shield' },
  { label: 'Log committee meeting', module: 'committee', icon: 'users' },
];

const ACTION_DOT: Record<string, string> = { create: 'low', update: 'info', delete: 'crit', reset: 'high', rights: 'med', session: 'mut' };

function fmtNow(): string {
  const d = new Date();
  const date = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function relTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (Number.isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Headline metrics that have a matching snapshot field for trend deltas. */
type TrendMetric = 'criticalResidual' | 'complianceScore' | 'openIncidents' | 'vulnsBreached' | 'findingsOverdue';

export function OverviewPage() {
  const store = useStore();
  const { navigate } = useNav();
  const auditPerms = usePermissions('audit-log');
  const searchRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<'customize' | 'quick' | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(readHidden);
  const [prev] = useState(previousSnapshot); // captured before today's snapshot is written
  const [events, setEvents] = useState(() => auditLog.list().slice(0, 6));
  useEffect(() => auditLog.subscribe(() => setEvents(auditLog.list().slice(0, 6))), []);

  const show = (key: string) => !hidden.has(key);
  const toggleSection = (key: string) => {
    setHidden((h) => {
      const next = new Set(h);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem(HIDE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  // ⌘K / Ctrl+K focuses search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close the header menus on any click outside a menu container.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-ov-menu]')) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  // Standalone module data — read once per mount (re-reads whenever you return
  // to the dashboard). RCSA data comes from the reactive store.
  const external = useMemo(
    () => ({
      incidents: incidentRepo.list(),
      vendors: vendorRepo.list(),
      policies: policyRepo.list(),
      accessReviews: accessRepo.list(),
      kpis: kpiRepo.list(),
      meetings: committeeRepo.list(),
      courses: awarenessRepo.list(),
      controls: complianceRepo.list(),
      findings: findingsRepo.list(),
      vulns: vulnRepo.list(),
    }),
    [],
  );

  const { assets, risks, treatments } = store;
  const data: OverviewData = useMemo(() => ({ assets, risks, treatments, ...external }), [assets, risks, treatments, external]);

  const full = useMemo(
    () => headline(assets, risks, treatments, external.incidents, external.controls, external.vulns, external.findings),
    [assets, risks, treatments, external],
  );

  // Record today's org-wide snapshot once (idempotent within a day).
  useEffect(() => {
    recordSnapshot({
      criticalResidual: full.criticalResidual,
      overdueTreatments: full.overdueTreatments,
      highValueAssets: full.highValueAssets,
      complianceScore: full.complianceScore,
      openIncidents: full.openIncidents,
      vulnsBreached: full.vulnsBreached,
      findingsOverdue: full.findingsOverdue,
    });
  }, [full]);

  const delta = (metric: TrendMetric): number | null => {
    if (!prev) return null;
    const before = prev[metric];
    return before == null ? null : full[metric] - before;
  };
  const periodLabel = prev ? `since ${prev.date}` : '';

  // ── Widget datasets ──
  const matches = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());

  const attention = useMemo(
    () => buildAttentionItems(data).filter((it) => matches(`${it.label} ${it.source} ${it.owner}`)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q],
  );
  const upcoming = useMemo(
    () => buildUpcoming(data, 90).filter((it) => matches(`${it.title} ${it.subtext}`)).slice(0, 7),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, q],
  );
  const tiles = useMemo(() => serviceHealth(data), [data]);

  const incidentWatch: WatchRow[] = useMemo(
    () =>
      external.incidents
        .filter(isOpen)
        .sort((a, b) => {
          const s = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
          return s !== 0 ? s : a.reportedAt < b.reportedAt ? -1 : 1; // oldest fires first
        })
        .filter((i) => matches(`${i.id} ${i.shortDesc} ${i.responsible}`))
        .slice(0, 6)
        .map((i) => ({
          id: i.id,
          label: i.shortDesc,
          pill: i.severity,
          pillTone: severityColor(i.severity),
          right: `${daysOpen(i) ?? 0}d open`,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [external.incidents, q],
  );

  const SECTIONS = [
    { key: 'health', label: 'Service health' },
    { key: 'incidents', label: 'Incident watch' },
    { key: 'activity', label: 'Recent activity' },
    { key: 'upcoming', label: 'Upcoming deadlines' },
  ];

  return (
    <>
      {/* Controls live in the shell header so the top bar matches the design while
          the portal keeps its sidebar. */}
      <PageHeader>
        <div className="relative w-[240px] lg:w-[320px] max-w-[42vw]" data-ov-menu>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          </span>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search attention items, incidents, deadlines…"
            className="w-full border rounded-full pl-9 pr-12 py-2 text-sm"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded border pointer-events-none" style={{ color: 'var(--text3)', borderColor: 'var(--border)' }}>⌘ K</span>
        </div>
        <div className="relative" data-ov-menu>
          <button onClick={() => setMenu(menu === 'customize' ? null : 'customize')} className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors hover:opacity-80" style={{ borderColor: 'var(--border)', color: 'var(--text2)', background: 'var(--surface)' }}>
            <Icon name="gear" size={15} /> Customize
          </button>
          {menu === 'customize' && (
            <div className="absolute right-0 mt-2 w-56 section-card p-2 z-50">
              <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-1" style={{ color: 'var(--text3)' }}>Show sections</div>
              {SECTIONS.map((s) => (
                <label key={s.key} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer text-[13px] risk-row" style={{ color: 'var(--text2)' }}>
                  <input type="checkbox" checked={show(s.key)} onChange={() => toggleSection(s.key)} className="w-4 h-4 accent-[var(--accent)]" />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="relative" data-ov-menu>
          <button onClick={() => setMenu(menu === 'quick' ? null : 'quick')} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--accent)' }}>
            + Quick Action
          </button>
          {menu === 'quick' && (
            <div className="absolute right-0 mt-2 w-56 section-card p-2 z-50">
              {QUICK_ACTIONS.map((a) => (
                <button key={a.module} onClick={() => { setMenu(null); setIntent(`new:${a.module}`); navigate(a.module); }} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-[13px] risk-row" style={{ color: 'var(--text2)' }}>
                  <span style={{ color: 'var(--accent)' }}><Icon name={a.icon} size={15} /></span>{a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="p-6 space-y-4">
        {/* KPI row — one card per domain (RCSA gets exactly one; it has its own page) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon="shield" tone="crit" title="Critical residual risks" value={String(full.criticalResidual)} sub={`${full.overdueTreatments} treatments overdue`} delta={delta('criticalResidual')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="RCSA dashboard" onClick={() => navigate('rcsa-dashboard')} />
          <KpiCard icon="bolt" tone="info" title="Open incidents" value={String(full.openIncidents)} sub={`${full.openCriticalHigh} critical / high`} delta={delta('openIncidents')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View incidents" onClick={() => navigate('incidents')} />
          <KpiCard icon="alert" tone="high" title="Vuln SLA breaches" value={String(full.vulnsBreached)} sub={`${full.openVulns} open vulnerabilities`} delta={delta('vulnsBreached')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View vulnerabilities" onClick={() => navigate('vulns')} />
          <KpiCard icon="edit" tone="med" title="Findings overdue" value={String(full.findingsOverdue)} sub={`${full.openFindings} open audit findings`} delta={delta('findingsOverdue')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View findings" onClick={() => navigate('findings')} />
          <KpiCard icon="check" tone="low" title="Compliance score" value={`${full.complianceScore}%`} sub="Across all frameworks" delta={delta('complianceScore')} higherIsBetter={true} periodLabel={periodLabel} linkLabel="View compliance" onClick={() => navigate('compliance')} />
        </div>

        {/* Middle row — cross-service worklist + per-service posture */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <Panel title="Top CISO attention items" meta={attention.length > 6 ? `6 of ` : attention.length} footer="Open master calendar" onFooter={() => navigate('master-calendar')} className="lg:col-span-6">
            <AttentionTable items={attention.slice(0, 6)} onOpen={navigate} />
          </Panel>
          {show('health') && (
            <Panel title="Service health" meta={`${tiles.length} services`} className="lg:col-span-6">
              <ServiceHealthGrid tiles={tiles} onOpen={navigate} />
            </Panel>
          )}
        </div>

        {/* Bottom row — ops watch + cross-service activity + what's next */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {show('incidents') && (
            <Panel title="Open incident watch" footer="View all incidents" onFooter={() => navigate('incidents')}>
              <WatchList rows={incidentWatch} empty="No open incidents. 🎉" onOpen={() => navigate('incidents')} />
            </Panel>
          )}
          {show('activity') && auditPerms.view && (
            <Panel title="Recent activity" meta="All services" footer="View audit log" onFooter={() => navigate('audit-log')}>
              {events.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text3)' }}>No recent activity yet.</div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {events.map((e) => (
                    <li key={e.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(--${ACTION_DOT[e.action] ?? 'mut'})` }} />
                      <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text2)' }}>
                        <b style={{ color: 'var(--text)' }}>{e.actor}</b> · {e.summary}
                      </span>
                      <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text3)' }}>{relTime(e.ts)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
          {show('upcoming') && (
            <Panel title="Upcoming reviews & deadlines" meta="Next 90 days" footer="Open master calendar" onFooter={() => navigate('master-calendar')}>
              <UpcomingList items={upcoming} onOpen={navigate} />
            </Panel>
          )}
        </div>

        <FooterStatus updated={fmtNow()} />
      </div>
    </>
  );
}
