import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useNav } from '../../state/NavContext';
import { treatmentStatus } from '../../domain/scoring';
import { Icon } from '../../components/common/Icon';
import { PageHeader } from '../rcsa/PageHeader';
import { incidentRepo } from '../incidents/repo';
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
  indexAssets,
  overdueTreatmentRows,
  residualHeatmap,
  residualLevel,
  riskDepartments,
  risksByDepartment,
  topResidualRisks,
  assetCriticality,
  effectiveLevel,
  type OverviewData,
} from './aggregate';
import { previousSnapshot, recordSnapshot } from './snapshots';
import {
  AttentionTable,
  DeptBars,
  DEFAULT_FILTERS,
  FilterBar,
  FooterStatus,
  KpiCard,
  OverdueTable,
  Panel,
  ResidualHeatmap,
  TopResidualTable,
  UpcomingList,
  type DashFilters,
} from './widgets';

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
  { label: 'New risk', module: 'risk-catalogue', icon: 'alert' },
  { label: 'New asset', module: 'asset-catalogue', icon: 'box' },
  { label: 'New treatment', module: 'treatment-catalogue', icon: 'tool' },
  { label: 'Log committee meeting', module: 'committee', icon: 'users' },
];

function fmtNow(): string {
  const d = new Date();
  const date = d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export function OverviewPage() {
  const store = useStore();
  const { navigate } = useNav();
  const searchRef = useRef<HTMLInputElement>(null);

  const [filters, setFilters] = useState<DashFilters>(DEFAULT_FILTERS);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState<'customize' | 'quick' | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(readHidden);
  const [prev] = useState(previousSnapshot); // captured before today's snapshot is written

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

  // Standalone module data — read once per mount (re-reads whenever you return to
  // the dashboard). RCSA data comes from the reactive store.
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
  const assetById = useMemo(() => indexAssets(assets), [assets]);
  const departments = useMemo(
    () => [...new Set(assets.map((a) => a.department).filter(Boolean))].sort(),
    [assets],
  );

  // ── Apply the global filters to the RCSA sets ──
  const treatmentDepartments = (riskIds: string[]): string[] => {
    const set = new Set<string>();
    riskIds.forEach((rid) => {
      const r = risks.find((x) => x.id === rid);
      r?.assetIds.forEach((aid) => { const d = assetById.get(aid)?.department; if (d) set.add(d); });
    });
    return [...set];
  };

  const assetsF = useMemo(
    () => assets.filter((a) => (!filters.dept || a.department === filters.dept) && (!filters.crit || assetCriticality(a) === filters.crit)),
    [assets, filters.dept, filters.crit],
  );
  const risksF = useMemo(
    () => risks.filter((r) => {
      if (filters.dept && !riskDepartments(r, assetById).includes(filters.dept)) return false;
      if (filters.level && effectiveLevel(r) !== filters.level) return false;
      if (filters.crit && !r.assetIds.some((id) => { const a = assetById.get(id); return a && assetCriticality(a) === filters.crit; })) return false;
      return true;
    }),
    [risks, assetById, filters.dept, filters.level, filters.crit],
  );
  const treatmentsF = useMemo(
    () => treatments.filter((t) => {
      if (filters.status && treatmentStatus(t) !== filters.status) return false;
      if (filters.dept && !treatmentDepartments(t.riskIds).includes(filters.dept)) return false;
      return true;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [treatments, risks, assetById, filters.status, filters.dept],
  );

  // ── Headline metrics: full (for trend + snapshot) and view (filtered) ──
  const full = useMemo(() => headline(assets, risks, treatments, external.incidents, external.controls), [assets, risks, treatments, external]);
  const view = useMemo(() => headline(assetsF, risksF, treatmentsF, external.incidents, external.controls), [assetsF, risksF, treatmentsF, external]);
  const filtersActive = !!(filters.dept || filters.crit || filters.level || filters.status);

  // Record today's org-wide snapshot once.
  useEffect(() => {
    recordSnapshot({
      criticalResidual: full.criticalResidual,
      overdueTreatments: full.overdueTreatments,
      highValueAssets: full.highValueAssets,
      complianceScore: full.complianceScore,
      openIncidents: full.openIncidents,
    });
  }, [full]);

  const delta = (metric: keyof typeof full): number | null =>
    !filtersActive && prev ? (full[metric] as number) - (prev[metric as keyof typeof prev] as number) : null;
  const periodLabel = prev ? `since ${prev.date}` : '';

  const assessedResidual = useMemo(() => risksF.filter((r) => residualLevel(r) != null).length, [risksF]);

  // ── Widget datasets ──
  const matches = (s: string) => !q.trim() || s.toLowerCase().includes(q.trim().toLowerCase());

  const attention = useMemo(() => {
    const data: OverviewData = { assets, risks: risksF, treatments: treatmentsF, ...external };
    return buildAttentionItems(data).filter((it) => matches(`${it.label} ${it.source} ${it.owner}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, risksF, treatmentsF, external, q]);

  const heatmap = useMemo(() => residualHeatmap(risksF), [risksF]);
  const deptRows = useMemo(() => risksByDepartment(risksF, assetById, 7), [risksF, assetById]);
  const topResidual = useMemo(() => topResidualRisks(risksF, 8).filter((r) => matches(`${r.id} ${r.assetId} ${r.level}`)).slice(0, 5), [risksF, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const overdueRows = useMemo(() => overdueTreatmentRows(treatmentsF, 12).filter((r) => matches(`${r.id} ${r.riskId}`)).slice(0, 6), [treatmentsF, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const horizon = filters.range === 'all' ? 3650 : Number(filters.range);
  const upcoming = useMemo(() => {
    const data: OverviewData = { assets, risks, treatments, ...external };
    return buildUpcoming(data, horizon).filter((it) => matches(`${it.title} ${it.subtext}`)).slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, risks, treatments, external, horizon, q]);

  const SECTIONS = [
    { key: 'filters', label: 'Global filters' },
    { key: 'heatmap', label: 'Risk heat map' },
    { key: 'dept', label: 'Risks by department' },
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
            placeholder="Search assets, risks, treatments, vendors…"
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
                <button key={a.module} onClick={() => { setMenu(null); navigate(a.module); }} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left text-[13px] risk-row" style={{ color: 'var(--text2)' }}>
                  <span style={{ color: 'var(--accent)' }}><Icon name={a.icon} size={15} /></span>{a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </PageHeader>

      <div className="p-6 space-y-4">
        {show('filters') && <FilterBar filters={filters} setFilters={setFilters} departments={departments} />}

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard icon="shield" tone="crit" title="Critical residual risks" value={String(view.criticalResidual)} sub={`${assessedResidual} residual risks assessed`} delta={delta('criticalResidual')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View risks" onClick={() => navigate('risk-catalogue')} />
          <KpiCard icon="clock" tone="high" title="Overdue treatments" value={String(view.overdueTreatments)} sub="Past their due date" delta={delta('overdueTreatments')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View treatments" onClick={() => navigate('treatment-catalogue')} />
          <KpiCard icon="alert" tone="med" title="High-value assets" value={String(view.highValueAssets)} sub={`${view.lowCoverageHighValue} with low control coverage`} delta={delta('highValueAssets')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View assets" onClick={() => navigate('asset-catalogue')} />
          <KpiCard icon="check" tone="low" title="Compliance score" value={`${view.complianceScore}%`} sub="Across all frameworks" delta={delta('complianceScore')} higherIsBetter={true} periodLabel={periodLabel} linkLabel="View compliance" onClick={() => navigate('compliance')} />
          <KpiCard icon="doc" tone="info" title="Open incidents" value={String(full.openIncidents)} sub={`${full.openCriticalHigh} critical / high`} delta={delta('openIncidents')} higherIsBetter={false} periodLabel={periodLabel} linkLabel="View incidents" onClick={() => navigate('incidents')} />
        </div>

        {/* Middle row — equal height */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <Panel title="Top CISO attention items" meta={attention.length} footer="View all attention items" onFooter={() => navigate('risk-catalogue')} className="lg:col-span-5">
            <AttentionTable items={attention.slice(0, 5)} onOpen={navigate} />
          </Panel>
          {show('heatmap') && (
            <Panel title="Risk heat map (residual)" footer="Open risk catalogue" onFooter={() => navigate('risk-catalogue')} className="lg:col-span-3" center>
              <ResidualHeatmap matrix={heatmap} />
            </Panel>
          )}
          {show('dept') && (
            <Panel title="Risks by department" meta="Top 7" footer="View full report" onFooter={() => navigate('risk-catalogue')} className={show('heatmap') ? 'lg:col-span-4' : 'lg:col-span-7'} center>
              <DeptBars rows={deptRows} />
            </Panel>
          )}
        </div>

        {/* Bottom row — equal height */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          <Panel title="Top residual risks" footer="View all risks" onFooter={() => navigate('risk-catalogue')}>
            <TopResidualTable rows={topResidual} onOpen={() => navigate('risk-catalogue')} />
          </Panel>
          <Panel title="Overdue treatments" footer="View all treatments" onFooter={() => navigate('treatment-catalogue')}>
            <OverdueTable rows={overdueRows} onOpen={() => navigate('treatment-catalogue')} />
          </Panel>
          {show('upcoming') && (
            <Panel title="Upcoming reviews & deadlines" footer="View policies & reviews" onFooter={() => navigate('policies')}>
              <UpcomingList items={upcoming} onOpen={navigate} />
            </Panel>
          )}
        </div>

        <FooterStatus updated={fmtNow()} />
      </div>
    </>
  );
}
