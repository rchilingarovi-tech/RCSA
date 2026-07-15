import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { getDashboardScope, type GlobalFilter } from '../../state/filters';
import { assetValue, criticality, isOverdue, treatmentStatus } from '../../domain/scoring';
import { ChartGrid, ChartPanel, HBarChart, type BarRow } from './primitives';

// RCSA dashboard charts — rebuilt on the shared token primitives with a STRICT
// colour policy: colour carries meaning only.
//   · severity / level scales → crit / high / med / low
//   · statuses → their established tokens (Overdue=crit, Open=high, …)
//   · neutral categories (departments, threats) → ONE colour; length is the signal
// Every widget keeps the exact same cross-filter click contract as before:
// clicking sets a GlobalFilter facet and the whole dashboard re-scopes together.

type IndexFilter = (g: GlobalFilter) => void;

// Chart catalogue — used by the show/hide "Customize" menu (same ids/key as before).
const CHART_DEFS: { id: string; label: string }[] = [
  { id: 'criticality', label: 'Asset Criticality' },
  { id: 'treatment', label: 'Treatment Status' },
  { id: 'heatmap', label: 'Residual Heat Map' },
  { id: 'department', label: 'Risks by Department' },
  { id: 'threats', label: 'Top 5 Threats' },
  { id: 'overdue', label: 'Overdue by Owner' },
  { id: 'accepted', label: 'Accepted Risks' },
  { id: 'gaps', label: 'Control Coverage Gaps' },
];
const ALL_IDS = CHART_DEFS.map((d) => d.id);
const VIS_KEY = 'rcsa.dashboard.charts';

function readVisible(): Set<string> {
  try {
    const raw = localStorage.getItem(VIS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((id) => ALL_IDS.includes(id)));
    }
  } catch {
    /* ignore */
  }
  return new Set(ALL_IDS);
}

// ── Meter rows (label · count · share · proportional bar) ────────────────────
interface MeterRow {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}

function MeterRows({ rows }: { rows: MeterRow[] }) {
  const total = Math.max(1, rows.reduce((s, r) => s + r.value, 0));
  return (
    <div className="flex flex-col justify-center gap-3 h-full">
      {rows.map((r) => {
        const pct = Math.round((r.value / total) * 100);
        return (
          <button key={r.label} onClick={r.onClick} className="text-left group">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: `var(--${r.tone})` }} />
              <span className="text-[12.5px]" style={{ color: r.active ? 'var(--accent)' : 'var(--text2)', fontWeight: r.active ? 700 : 500 }}>{r.label}</span>
              <span className="ml-auto text-[14px] font-bold tabular-nums" style={{ color: 'var(--text)' }}>{r.value}</span>
              <span className="text-[11px] tabular-nums w-9 text-right" style={{ color: 'var(--text3)' }}>{pct}%</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface3)', outline: r.active ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
              <span className="block h-full rounded-full transition-all group-hover:brightness-95" style={{ width: `${Math.max(r.value > 0 ? 5 : 0, pct)}%`, background: `var(--${r.tone})` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Residual heat map (5×5, score-band tones, click-to-filter) ───────────────
const cellTone = (score: number): string => (score <= 4 ? 'low' : score <= 9 ? 'med' : score <= 14 ? 'high' : 'crit');

function HeatGrid({ count, active, onCell }: { count: (i: number, l: number) => number; active: { i: number; l: number } | null; onCell: (i: number, l: number) => void }) {
  const impacts = [5, 4, 3, 2, 1];
  const likelihoods = [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text3)' }}>Impact</span>
        </div>
        <div className="flex-1">
          <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
            {impacts.map((imp) => (
              <div key={imp} className="contents">
                <div className="flex items-center justify-center text-[11px] font-semibold pr-1" style={{ color: 'var(--text3)' }}>{imp}</div>
                {likelihoods.map((lik) => {
                  const n = count(imp, lik);
                  const tone = cellTone(imp * lik);
                  const isActive = active?.i === imp && active?.l === lik;
                  return (
                    <button
                      key={lik}
                      onClick={() => onCell(imp, lik)}
                      title={`Impact ${imp} × Likelihood ${lik}: ${n} risk${n === 1 ? '' : 's'}`}
                      className="aspect-square rounded-md flex items-center justify-center text-[13px] font-bold tabular-nums transition-transform hover:scale-105"
                      style={{
                        background: n > 0 ? `var(--${tone})` : `var(--${tone}-bg)`,
                        color: n > 0 ? '#fff' : 'var(--text3)',
                        opacity: n > 0 ? 1 : 0.55,
                        outline: isActive ? '2.5px solid var(--accent)' : 'none',
                        outlineOffset: 1,
                      }}
                    >
                      {n > 0 ? n : ''}
                    </button>
                  );
                })}
              </div>
            ))}
            <div />
            {likelihoods.map((lik) => (
              <div key={lik} className="text-center text-[11px] font-semibold pt-1" style={{ color: 'var(--text3)' }}>{lik}</div>
            ))}
          </div>
          <div className="text-center text-[10px] font-bold uppercase tracking-wider mt-1.5" style={{ color: 'var(--text3)' }}>Likelihood</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardCharts() {
  const store = useStore();
  const { setGlobalFilter } = store;
  const g = store.globalFilter;
  const apply: IndexFilter = setGlobalFilter;

  const [visible, setVisible] = useState<Set<string>>(readVisible);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(VIS_KEY, JSON.stringify([...visible])); } catch { /* ignore */ }
  }, [visible]);
  const show = (id: string) => visible.has(id);
  const toggle = (id: string) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Unified cross-filter scope (unchanged logic).
  const { assets, risks, treatments } = useMemo(
    () =>
      getDashboardScope({
        assets: store.assets,
        risks: store.risks,
        treatments: store.treatments,
        selectedAssetId: store.selectedAssetId,
        globalFilter: store.globalFilter,
        assetFilters: store.assetFilters,
        riskFilters: store.riskFilters,
      }),
    [store.assets, store.risks, store.treatments, store.selectedAssetId, store.globalFilter, store.assetFilters, store.riskFilters],
  );

  // 1. Asset Criticality — semantic level scale.
  const crit = useMemo(() => {
    const counts: Record<'Low' | 'Medium' | 'High', number> = { Low: 0, Medium: 0, High: 0 };
    assets.forEach((a) => { counts[criticality(assetValue(a))[0] as 'Low' | 'Medium' | 'High']++; });
    return counts;
  }, [assets]);
  const CRIT_TONE: Record<string, string> = { Low: 'low', Medium: 'med', High: 'crit' };

  // 2. Treatment Status — status tokens.
  const treat = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, 'In Progress': 0, Completed: 0, Overdue: 0 };
    treatments.forEach((t) => { counts[treatmentStatus(t)] = (counts[treatmentStatus(t)] || 0) + 1; });
    return counts;
  }, [treatments]);
  const TREAT_TONE: Record<string, string> = { Open: 'high', 'In Progress': 'info', Completed: 'low', Overdue: 'crit' };

  // 3. Residual Heat Map.
  const heatCount = (impact: number, likelihood: number) =>
    risks.filter((r) => r.resImpact === impact && r.resLikelihood === likelihood).length;
  const heatActive = g?.type === 'riskHeat' ? g.value : null;

  // 4. Risks by Department — neutral category → ONE colour, ranked.
  const deptRows: BarRow[] = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.forEach((r) => {
      const depts = new Set(r.assetIds.map((id) => assets.find((x) => x.id === id)?.department).filter(Boolean) as string[]);
      depts.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([d, n]) => ({ key: `dept:${d}`, label: d, tone: 'accent' as const, value: n }));
  }, [assets, risks]);

  // 5. Top 5 Threats — neutral category → ONE colour, ranked.
  const threatRows: BarRow[] = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.forEach((r) => { counts[r.threat] = (counts[r.threat] || 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, n]) => ({ key: `thr:${t}`, label: t, tone: 'accent' as const, value: n }));
  }, [risks]);

  // 6. Overdue by Owner — overdue is red, full stop.
  const overdueRows: BarRow[] = useMemo(() => {
    const counts: Record<string, number> = {};
    treatments.filter(isOverdue).forEach((t) => {
      const key = t.owner || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([o, n]) => ({ key: `own:${o}`, label: o, tone: 'crit' as const, value: n }));
  }, [treatments]);

  // 7. Accepted Risks by Dept — acceptance is a deliberate decision → purple.
  const acceptedRows: BarRow[] = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.filter((r) => r.assessment === 'Accept').forEach((r) => {
      const depts = new Set(r.assetIds.map((id) => assets.find((x) => x.id === id)?.department).filter(Boolean) as string[]);
      depts.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([d, n]) => ({ key: `acc:${d}`, label: d, tone: 'purple' as const, value: n }));
  }, [assets, risks]);

  // 8. Control Coverage Gaps — semantic: none=red, thin=amber, covered=green.
  const gap = useMemo(() => {
    const counts = { '0 Controls': 0, '1-2 Controls': 0, '3+ Controls': 0 };
    risks.forEach((r) => {
      const c = r.controls.length;
      if (c === 0) counts['0 Controls']++;
      else if (c <= 2) counts['1-2 Controls']++;
      else counts['3+ Controls']++;
    });
    return counts;
  }, [risks]);
  const GAP_TONE = ['crit', 'med', 'low'];
  const gapKeys = Object.keys(gap) as (keyof typeof gap)[];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-end gap-3 mb-2 relative">
        <span className="text-[11.5px]" style={{ color: 'var(--text3)' }}>Every chart is a filter — click to slice the whole dashboard.</span>
        <button onClick={() => setMenuOpen((o) => !o)} className="btn-neutral border rounded px-3 py-1.5 text-sm">⚙ Customize</button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="absolute right-0 top-full mt-1 z-20 section-card p-3 w-64">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Show charts</p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {CHART_DEFS.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={show(d.id)} onChange={() => toggle(d.id)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <ChartGrid sortKey="rcsa-charts">
        {show('criticality') && (
          <ChartPanel title="Asset criticality" span={4}>
            <MeterRows rows={(['Low', 'Medium', 'High'] as const).map((k) => ({
              label: k,
              value: crit[k],
              tone: CRIT_TONE[k],
              active: g?.type === 'assetCriticality' && g.value === k,
              onClick: () => apply({ type: 'assetCriticality', value: k, label: `Assets: ${k} Criticality` }),
            }))} />
          </ChartPanel>
        )}

        {show('treatment') && (
          <ChartPanel title="Treatment status" span={4}>
            <MeterRows rows={Object.keys(treat).map((k) => ({
              label: k,
              value: treat[k],
              tone: TREAT_TONE[k] ?? 'mut',
              active: k === 'Overdue' ? g?.type === 'riskOverdue' : g?.type === 'riskStatus' && g.value === k,
              onClick: () =>
                k === 'Overdue'
                  ? apply({ type: 'riskOverdue', value: true, label: 'Overdue Risk Plans' })
                  : apply({ type: 'riskStatus', value: k, label: `Risks: ${k} Status` }),
            }))} />
          </ChartPanel>
        )}

        {show('gaps') && (
          <ChartPanel title="Control coverage" span={4}>
            <MeterRows rows={gapKeys.map((k, i) => ({
              label: k,
              value: gap[k],
              tone: GAP_TONE[i],
              active: g?.type === 'riskControlCount' && g.value === i,
              onClick: () => apply({ type: 'riskControlCount', value: i as 0 | 1 | 2, label: `Risks with ${k}` }),
            }))} />
          </ChartPanel>
        )}

        {show('heatmap') && (
          <ChartPanel title="Residual heat map" span={4}>
            <HeatGrid
              count={heatCount}
              active={heatActive}
              onCell={(impact, likelihood) =>
                apply({ type: 'riskHeat', value: { i: impact, l: likelihood }, label: `Risks: Impact ${impact}, Likelihood ${likelihood}` })}
            />
          </ChartPanel>
        )}

        {show('department') && (
          <ChartPanel title="Risks by department" span={4}>
            <HBarChart
              rows={deptRows}
              activeKey={g?.type === 'riskDept' ? `dept:${g.value}` : null}
              onSelect={(key) => { const d = key.slice(5); apply({ type: 'riskDept', value: d, label: `Risks for Dept: ${d}` }); }}
            />
          </ChartPanel>
        )}

        {show('threats') && (
          <ChartPanel title="Top threats" span={4}>
            <HBarChart
              rows={threatRows}
              activeKey={g?.type === 'riskThreat' ? `thr:${g.value}` : null}
              onSelect={(key) => { const t = key.slice(4); apply({ type: 'riskThreat', value: t, label: `Risks: Threat - ${t}` }); }}
            />
          </ChartPanel>
        )}

        {show('overdue') && (
          <ChartPanel title="Overdue treatments by owner" span={6}>
            <HBarChart
              rows={overdueRows}
              activeKey={g?.type === 'riskOverdueOwner' ? `own:${g.value}` : null}
              onSelect={(key) => { const o = key.slice(4); apply({ type: 'riskOverdueOwner', value: o, label: `Overdue Risks for ${o}` }); }}
            />
          </ChartPanel>
        )}

        {show('accepted') && (
          <ChartPanel title="Accepted risks by department" span={6}>
            <HBarChart
              rows={acceptedRows}
              activeKey={g?.type === 'riskAcceptedDept' ? `acc:${g.value}` : null}
              onSelect={(key) => { const d = key.slice(4); apply({ type: 'riskAcceptedDept', value: d, label: `Accepted Risks for Dept: ${d}` }); }}
            />
          </ChartPanel>
        )}
      </ChartGrid>
    </div>
  );
}
