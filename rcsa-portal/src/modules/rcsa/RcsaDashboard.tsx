import { Fragment, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { useUi } from '../../components/common/UiProvider';
import { useNav } from '../../state/NavContext';
import { PageHeader } from './PageHeader';
import { KpiCards } from '../../components/KpiCards';
import { Pill } from '../../components/common/Pill';
import { auditLog } from '../../audit/auditLog';
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
import {
  assetValue,
  criticality,
  hasResidual,
  inherentScore,
  residualScore,
  riskLevel,
  treatmentStatus,
  treatmentsForRisk,
} from '../../domain/scoring';
import type { Risk } from '../../data/models';

// RCSA Dashboard — SentinelGRC visual design + click-to-cross-filter, wired to OUR
// existing data (assets/risks/treatments from the shared store) and OUR scoring.
// Every figure below is computed with our domain functions; nothing is re-derived
// or "simplified". KpiCards is reused unchanged, so the KPI strip is identical.

const ACTION_DOT: Record<string, string> = { create: 'low', update: 'info', delete: 'crit', reset: 'high', rights: 'med', session: 'mut' };
const CRIT_TONE: Record<string, Tone> = { High: 'crit', Medium: 'med', Low: 'low' };
const LEVEL_TONE: Record<string, Tone> = { Critical: 'crit', High: 'high', Medium: 'med', Low: 'low' };
const DECISION_TONE: Record<string, Tone> = { Mitigate: 'info', Accept: 'med', Transfer: 'purple', Avoid: 'mut' };
const TSTATUS_TONE: Record<string, Tone> = { Open: 'mut', 'In Progress': 'info', Completed: 'low', Overdue: 'crit' };

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

export function RcsaDashboard() {
  const store = useStore();
  const modals = useModals();
  const ui = useUi();
  const nav = useNav();
  const perms = usePermissions('rcsa-dashboard');
  const auditPerms = usePermissions('audit-log');
  const [events, setEvents] = useState(() => auditLog.list().slice(0, 8));
  useEffect(() => auditLog.subscribe(() => setEvents(auditLog.list().slice(0, 8))), []);

  const { assets, risks, treatments } = store;
  const filter = useChartFilter<Risk>();

  // Per-asset criticality label (our scoring), memoised for chart + predicates.
  const assetCrit = useMemo(() => {
    const m = new Map<string, string>();
    assets.forEach((a) => m.set(a.id, criticality(assetValue(a))[0]));
    return m;
  }, [assets]);
  const deptsOf = useMemo(() => {
    const m = new Map<string, string[]>();
    risks.forEach((r) => {
      const set = new Set(r.assetIds.map((id) => assets.find((a) => a.id === id)?.department).filter(Boolean) as string[]);
      m.set(r.id, [...set]);
    });
    return m;
  }, [assets, risks]);

  // ── Chart data (our logic) ──
  const critRows: BarRow[] = (['High', 'Medium', 'Low'] as const).map((lvl) => ({
    key: `crit:${lvl}`, label: lvl, tone: CRIT_TONE[lvl], value: assets.filter((a) => assetCrit.get(a.id) === lvl).length,
  }));
  const treatRows: BarRow[] = (['Open', 'In Progress', 'Completed', 'Overdue'] as const).map((s) => ({
    key: `treat:${s}`, label: s, tone: TSTATUS_TONE[s], value: treatments.filter((t) => treatmentStatus(t) === s).length,
  }));
  const decisionSeg: DonutSegment[] = (['Mitigate', 'Accept', 'Transfer', 'Avoid'] as const).map((d) => ({
    key: `dec:${d}`, label: d, tone: DECISION_TONE[d], value: risks.filter((r) => r.assessment === d).length,
  }));
  const deptRows: BarRow[] = useMemo(() => {
    const counts = new Map<string, number>();
    deptsOf.forEach((ds) => ds.forEach((d) => counts.set(d, (counts.get(d) || 0) + 1)));
    return [...counts.entries()].map(([d, v]) => ({ key: `dept:${d}`, label: d, tone: 'info' as Tone, value: v })).sort((a, b) => b.value - a.value);
  }, [deptsOf]);
  const heatCount = (impact: number, likelihood: number) => risks.filter((r) => hasResidual(r) && r.resImpact === impact && r.resLikelihood === likelihood).length;

  // ── Cross-filter selectors (predicates on OUR risk model) ──
  const selectCrit = (key: string) => { const l = key.slice(5); filter.select(key, l, (r) => r.assetIds.some((id) => assetCrit.get(id) === l)); };
  const selectTreat = (key: string) => { const s = key.slice(6); filter.select(key, s, (r) => treatmentsForRisk(treatments, r.id).some((t) => treatmentStatus(t) === s)); };
  const selectDecision = (key: string) => { const d = key.slice(4); filter.select(key, d, (r) => r.assessment === d); };
  const selectDept = (key: string) => { const d = key.slice(5); filter.select(key, d, (r) => (deptsOf.get(r.id) || []).includes(d)); };
  const selectHeat = (impact: number, likelihood: number) => filter.select(`heat:${impact}-${likelihood}`, `Residual ${impact}×${likelihood}`, (r) => hasResidual(r) && r.resImpact === impact && r.resLikelihood === likelihood);
  const chipFor = (prefix: string) => (filter.active && filter.active.key.startsWith(prefix) ? filter.active.label : null);

  const matching = filter.apply(risks);

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => modals.openImport()} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Import from CSV</button>}
        {perms.export && <button onClick={() => modals.openExport()} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Export to CSV</button>}
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Reset demo data?', 'This restores the original sample assets and risks and discards your changes.', () => { void store.resetDemoData(); store.clearGlobalFilter(); ui.toast('Demo data restored', 'bg-green-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <KpiCards />

        <ChartGrid>
          <ChartPanel title="Asset criticality" span={4} filterLabel={chipFor('crit:')} onClearFilter={filter.clear}>
            <HBarChart rows={critRows} activeKey={filter.activeKey} onSelect={selectCrit} />
          </ChartPanel>
          <ChartPanel title="Treatment status" span={4} filterLabel={chipFor('treat:')} onClearFilter={filter.clear}>
            <HBarChart rows={treatRows} activeKey={filter.activeKey} onSelect={selectTreat} />
          </ChartPanel>
          <ChartPanel title="Risk decisions" span={4} filterLabel={chipFor('dec:')} onClearFilter={filter.clear}>
            <DonutChart segments={decisionSeg} center={String(risks.length)} sub="risks" activeKey={filter.activeKey} onSelect={selectDecision} />
          </ChartPanel>

          <ChartPanel title="Residual heat map" span={6} filterLabel={chipFor('heat:')} onClearFilter={filter.clear}>
            <div className="text-[11px] mb-2" style={{ color: 'var(--text3)' }}>Impact ↑ / Likelihood → · assessed residual risks only</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(5, 1fr)', gridAutoRows: '1fr', gap: 5 }}>
              {[5, 4, 3, 2, 1].map((im) => (
                <Fragment key={im}>
                  <div className="flex items-center justify-center text-[10px] font-semibold" style={{ color: 'var(--text3)' }}>{im}</div>
                  {[1, 2, 3, 4, 5].map((li) => {
                    const n = heatCount(im, li);
                    const tone = LEVEL_TONE[riskLevel(im * li)[0]];
                    const key = `heat:${im}-${li}`;
                    const active = filter.activeKey === key;
                    return (
                      <button key={li} type="button" onClick={() => selectHeat(im, li)} title={`Impact ${im} × Likelihood ${li} — ${n} risk${n === 1 ? '' : 's'}`}
                        className="rounded-md flex items-center justify-center font-bold" style={{ aspectRatio: '1.6', background: `var(--${tone})`, opacity: n ? 1 : 0.35, color: '#fff', fontSize: 13, border: active ? '2px solid var(--text)' : '2px solid transparent' }}>
                        {n || ''}
                      </button>
                    );
                  })}
                </Fragment>
              ))}
              <div />
              {[1, 2, 3, 4, 5].map((li) => <div key={li} className="flex items-center justify-center text-[10px] font-semibold" style={{ color: 'var(--text3)' }}>{li}</div>)}
            </div>
          </ChartPanel>

          <ChartPanel title="Risks by department" span={6} filterLabel={chipFor('dept:')} onClearFilter={filter.clear}>
            <HBarChart rows={deptRows} activeKey={filter.activeKey} onSelect={selectDept} />
          </ChartPanel>
        </ChartGrid>

        {/* Matching risks (cross-filter target) */}
        <div className="section-card">
          <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Matching Risks</h2>
              <span className="text-xs" style={{ color: 'var(--text3)' }}>{matching.length} risk{matching.length !== 1 ? 's' : ''}</span>
              {filter.active && <button onClick={filter.clear} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--ok-bg)', color: 'var(--accent)' }}>Filtered: {filter.active.label} ✕</button>}
            </div>
            <button onClick={() => nav.navigate('risk-catalogue')} className="btn-neutral bg-white border px-3 py-1.5 rounded text-xs">Open in Risk Catalogue →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-[10.5px] uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
                <tr>
                  <th className="text-left px-4 py-3">Risk</th>
                  <th className="text-left px-4 py-3">Inherent</th>
                  <th className="text-left px-4 py-3">Residual</th>
                  <th className="text-left px-4 py-3">Decision</th>
                  <th className="text-left px-4 py-3">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matching.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No risks match this slice.</td></tr>
                ) : matching.map((r) => {
                  const inh = inherentScore(r);
                  const res = residualScore(r);
                  const depts = deptsOf.get(r.id) || [];
                  return (
                    <tr key={r.id} className="risk-row cursor-pointer" onClick={() => modals.editRisk(r.id)}>
                      <td className="px-4 py-3">
                        <div className="font-semibold" style={{ color: 'var(--text)' }}>{r.threat}</div>
                        <div className="text-xs" style={{ color: 'var(--text3)' }}>{depts.join(', ') || 'No department'}</div>
                      </td>
                      <td className="px-4 py-3"><Pill text={`${riskLevel(inh)[0]} (${inh})`} k={LEVEL_TONE[riskLevel(inh)[0]]} /></td>
                      <td className="px-4 py-3">{res == null ? <Pill text="Not assessed" k="mut" /> : <Pill text={`${riskLevel(res)[0]} (${res})`} k={LEVEL_TONE[riskLevel(res)[0]]} />}</td>
                      <td className="px-4 py-3"><Pill text={r.assessment} k={DECISION_TONE[r.assessment]} /></td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text2)' }}>{r.owner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent activity */}
        {auditPerms.view && (
          <div className="section-card">
            <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Recent Activity</h2>
              <button onClick={() => nav.navigate('audit-log')} className="btn-neutral bg-white border px-3 py-1.5 rounded text-xs">View audit log →</button>
            </div>
            {events.length === 0 ? (
              <div className="px-5 py-6 text-sm" style={{ color: 'var(--text3)' }}>No recent activity yet.</div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {events.map((e) => (
                  <li key={e.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `var(--${ACTION_DOT[e.action] ?? 'mut'})` }} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text2)' }}><b style={{ color: 'var(--text)' }}>{e.actor}</b> · {e.summary}</span>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text3)' }}>{relTime(e.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
