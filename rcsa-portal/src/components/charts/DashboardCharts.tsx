import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, type ChartOptions } from 'chart.js';
import './registerCharts';
import { ChartCard } from './ChartCard';
import { Heatmap } from './Heatmap';
import { useStore } from '../../state/AppStore';
import { getDashboardScope } from '../../state/filters';
import { assetValue, criticality, isOverdue, treatmentStatus } from '../../domain/scoring';
import { useTheme } from '../../state/ThemeProvider';
import { chartPalette } from './chartTheme';

type IndexHandler = (index: number) => void;

// Chart catalogue — used by the show/hide "Customize" menu.
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

/** Base options: hidden legend + centered title + click-by-index handler. */
function baseOptions(title: string, onIndex: IndexHandler, textColor: string): ChartOptions<any> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: textColor, font: { size: 14 } },
    },
    onClick: (_e: unknown, els: { index: number }[]) => {
      if (els.length) onIndex(els[0].index);
    },
  };
}

export function DashboardCharts() {
  const store = useStore();
  const { setGlobalFilter } = store;
  const { theme } = useTheme();
  const pal = useMemo(() => chartPalette(theme), [theme]);

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

  useEffect(() => {
    ChartJS.defaults.color = pal.text;
    ChartJS.defaults.borderColor = pal.grid;
  }, [pal]);

  // Unified cross-filter: every chart click sets a facet; the whole dashboard
  // re-scopes together (asset filters + risk slicers + facet).
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

  // 1. Asset Criticality
  const crit = useMemo(() => {
    const counts: Record<'Low' | 'Medium' | 'High', number> = { Low: 0, Medium: 0, High: 0 };
    assets.forEach((a) => { counts[criticality(assetValue(a))[0] as 'Low' | 'Medium' | 'High']++; });
    return counts;
  }, [assets]);
  const critKeys = Object.keys(crit) as (keyof typeof crit)[];

  // 2. Treatment Status — counts of treatment entities by effective status.
  const treat = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, 'In Progress': 0, Completed: 0, Overdue: 0 };
    treatments.forEach((t) => { counts[treatmentStatus(t)] = (counts[treatmentStatus(t)] || 0) + 1; });
    return counts;
  }, [treatments]);
  const treatKeys = Object.keys(treat);

  // 3. Residual Heat Map (grid) — count of risks at each residual Impact × Likelihood.
  const heatCount = (impact: number, likelihood: number) =>
    risks.filter((r) => r.resImpact === impact && r.resLikelihood === likelihood).length;
  const heatActive = store.globalFilter?.type === 'riskHeat' ? store.globalFilter.value : null;

  // 4. Risks by Department — a shared risk counts in EACH department it touches.
  const dept = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.forEach((r) => {
      const depts = new Set(
        r.assetIds.map((id) => assets.find((x) => x.id === id)?.department).filter(Boolean) as string[],
      );
      depts.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
    });
    return counts;
  }, [assets, risks]);
  const deptKeys = Object.keys(dept);

  // 5. Top 5 Threats
  const topThreats = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.forEach((r) => { counts[r.threat] = (counts[r.threat] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [risks]);

  // 6. Overdue by Owner — overdue treatment entities grouped by treatment owner.
  const overdue = useMemo(() => {
    const counts: Record<string, number> = {};
    treatments.filter(isOverdue).forEach((t) => {
      const key = t.owner || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [treatments]);
  const overdueKeys = Object.keys(overdue);

  // 7. Accepted Risks by Dept — shared risks count in each department they touch.
  const accepted = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.filter((r) => r.assessment === 'Accept').forEach((r) => {
      const depts = new Set(
        r.assetIds.map((id) => assets.find((x) => x.id === id)?.department).filter(Boolean) as string[],
      );
      depts.forEach((d) => { counts[d] = (counts[d] || 0) + 1; });
    });
    return counts;
  }, [assets, risks]);
  const acceptedKeys = Object.keys(accepted);

  // 8. Control Coverage Gaps
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
  const gapKeys = Object.keys(gap);

  // Fewer visible charts → taller cards, so the survivors grow to fill the space
  // instead of leaving a short, stranded row. Width grows automatically via the
  // auto-fit grid below.
  const visibleCount = ALL_IDS.filter((id) => visible.has(id)).length;
  const cardHeight = visibleCount <= 1 ? 460 : visibleCount <= 2 ? 380 : visibleCount <= 4 ? 320 : 260;

  return (
    <div className="mb-4" style={{ ['--chart-h' as string]: `${cardHeight}px` }}>
      <div className="flex justify-end mb-2 relative">
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

      <div className="chart-grid" style={{ ['--chart-cols' as string]: Math.min(visibleCount, 4) }}>
        {show('criticality') && (
          <ChartCard title="Click a bar to filter by criticality">
            <Bar
              data={{ labels: critKeys, datasets: [{ data: critKeys.map((k) => crit[k]), backgroundColor: pal.bar, borderRadius: 6 }] }}
              options={baseOptions('Asset Criticality Pipeline', (i) =>
                setGlobalFilter({ type: 'assetCriticality', value: critKeys[i], label: `Assets: ${critKeys[i]} Criticality` }), pal.text)}
            />
          </ChartCard>
        )}

        {show('treatment') && (
          <ChartCard title="Click a segment to filter by treatment status">
            <Doughnut
              data={{ labels: treatKeys, datasets: [{ data: treatKeys.map((k) => treat[k]), backgroundColor: pal.donut, borderColor: pal.grid, borderWidth: 1 }] }}
              options={{
                ...baseOptions('Risk Treatment Status', (i) => {
                  const lbl = treatKeys[i];
                  if (lbl === 'Overdue') setGlobalFilter({ type: 'riskOverdue', value: true, label: 'Overdue Risk Plans' });
                  else setGlobalFilter({ type: 'riskStatus', value: lbl, label: `Risks: ${lbl} Status` });
                }, pal.text),
                plugins: {
                  legend: { display: true, position: 'bottom', labels: { boxWidth: 12 } },
                  title: { display: true, text: 'Risk Treatment Status', color: pal.text },
                },
              }}
            />
          </ChartCard>
        )}

        {show('heatmap') && (
          <ChartCard title="Click a cell to filter by residual Impact × Likelihood">
            <Heatmap
              count={heatCount}
              active={heatActive}
              onCell={(impact, likelihood) =>
                setGlobalFilter({ type: 'riskHeat', value: { i: impact, l: likelihood }, label: `Risks: Impact ${impact}, Likelihood ${likelihood}` })}
            />
          </ChartCard>
        )}

        {show('department') && (
          <ChartCard title="Click a bar to filter by department">
            <Bar
              data={{ labels: deptKeys, datasets: [{ data: deptKeys.map((k) => dept[k]), backgroundColor: deptKeys.map((_, i) => pal.dept[i % pal.dept.length]), borderRadius: 6 }] }}
              options={baseOptions('Risks by Department', (i) =>
                setGlobalFilter({ type: 'riskDept', value: deptKeys[i], label: `Risks for Dept: ${deptKeys[i]}` }), pal.text)}
            />
          </ChartCard>
        )}

        {show('threats') && (
          <ChartCard title="Click a bar to filter by threat">
            <Bar
              data={{
                labels: topThreats.map((t) => (t[0].length > 15 ? t[0].substring(0, 15) + '...' : t[0])),
                datasets: [{ data: topThreats.map((t) => t[1]), backgroundColor: pal.threats, borderRadius: 6 }],
              }}
              options={{
                ...baseOptions('Top 5 Threats', (i) =>
                  setGlobalFilter({ type: 'riskThreat', value: topThreats[i][0], label: `Risks: Threat - ${topThreats[i][0]}` }), pal.text),
                indexAxis: 'y',
              }}
            />
          </ChartCard>
        )}

        {show('overdue') && (
          <ChartCard title="Click a bar to filter overdue by owner">
            <Bar
              data={{
                labels: overdueKeys.length ? overdueKeys : ['None'],
                datasets: [{ data: overdueKeys.length ? overdueKeys.map((k) => overdue[k]) : [0], backgroundColor: pal.overdue, borderRadius: 6 }],
              }}
              options={baseOptions('Overdue by Owner', (i) => {
                if (overdueKeys.length) setGlobalFilter({ type: 'riskOverdueOwner', value: overdueKeys[i], label: `Overdue Risks for ${overdueKeys[i]}` });
              }, pal.text)}
            />
          </ChartCard>
        )}

        {show('accepted') && (
          <ChartCard title="Click a segment to filter accepted by department">
            <Pie
              data={{
                labels: acceptedKeys.length ? acceptedKeys : ['None'],
                datasets: [{ data: acceptedKeys.length ? acceptedKeys.map((k) => accepted[k]) : [1], backgroundColor: pal.accepted, borderColor: pal.grid, borderWidth: 1 }],
              }}
              options={{
                ...baseOptions('Accepted Risks', (i) => {
                  if (acceptedKeys.length) setGlobalFilter({ type: 'riskAcceptedDept', value: acceptedKeys[i], label: `Accepted Risks for Dept: ${acceptedKeys[i]}` });
                }, pal.text),
                plugins: {
                  legend: { display: true, position: 'right', labels: { boxWidth: 10 } },
                  title: { display: true, text: 'Accepted Risks', color: pal.text },
                },
              }}
            />
          </ChartCard>
        )}

        {show('gaps') && (
          <ChartCard title="Click a bar to filter by control coverage">
            <Bar
              data={{ labels: gapKeys, datasets: [{ data: gapKeys.map((k) => gap[k as keyof typeof gap]), backgroundColor: pal.gaps, borderRadius: 6 }] }}
              options={baseOptions('Control Coverage Gaps', (i) =>
                setGlobalFilter({ type: 'riskControlCount', value: i as 0 | 1 | 2, label: `Risks with ${gapKeys[i]}` }), pal.text)}
            />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
