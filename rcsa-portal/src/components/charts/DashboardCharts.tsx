import { useMemo } from 'react';
import { Bar, Doughnut, Pie, Bubble } from 'react-chartjs-2';
import type { ChartOptions } from 'chart.js';
import './registerCharts';
import { ChartCard } from './ChartCard';
import { useStore } from '../../state/AppStore';
import { assetValue, criticality, isOverdue } from '../../domain/scoring';

type IndexHandler = (index: number) => void;

/** Base options: hidden legend + centered title + click-by-index handler (ported from defaultOpts). */
function baseOptions(title: string, onIndex: IndexHandler): ChartOptions<any> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: '#0F172A', font: { size: 14 } },
    },
    onClick: (_e: unknown, els: { index: number }[]) => {
      if (els.length) onIndex(els[0].index);
    },
  };
}

export function DashboardCharts() {
  const store = useStore();
  const { assets, risks, setGlobalFilter } = store;

  // 1. Asset Criticality
  const crit = useMemo(() => {
    const counts: Record<'Low' | 'Medium' | 'High', number> = { Low: 0, Medium: 0, High: 0 };
    assets.forEach((a) => { counts[criticality(assetValue(a))[0] as 'Low' | 'Medium' | 'High']++; });
    return counts;
  }, [assets]);
  const critKeys = Object.keys(crit) as (keyof typeof crit)[];

  // 2. Treatment Status
  const treat = useMemo(() => {
    const counts: Record<string, number> = { Open: 0, 'In Progress': 0, Completed: 0, Overdue: 0 };
    risks.forEach((r) => {
      if (isOverdue(r)) counts.Overdue++;
      else counts[r.treatmentStatus] = (counts[r.treatmentStatus] || 0) + 1;
    });
    return counts;
  }, [risks]);
  const treatKeys = Object.keys(treat);

  // 3. Residual Heat Map (bubble)
  const heatData = useMemo(() => {
    const data: { x: number; y: number; r: number; count: number; bg: string }[] = [];
    for (let x = 1; x <= 5; x++) {
      for (let y = 1; y <= 5; y++) {
        const count = risks.filter((r) => r.resImpact === x && r.resLikelihood === y).length;
        if (count > 0) {
          const score = x * y;
          const bg = score <= 4 ? '#22c55e' : score <= 9 ? '#eab308' : score <= 14 ? '#f97316' : '#ef4444';
          data.push({ x, y, r: count * 6 + 4, count, bg });
        }
      }
    }
    return data;
  }, [risks]);

  // 4. Risks by Department
  const dept = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.forEach((r) => {
      const a = assets.find((x) => x.id === r.assetId);
      if (a) counts[a.department] = (counts[a.department] || 0) + 1;
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

  // 6. Overdue by Owner
  const overdue = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.filter(isOverdue).forEach((r) => {
      const key = r.responsible || 'Unassigned';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [risks]);
  const overdueKeys = Object.keys(overdue);

  // 7. Accepted Risks by Dept
  const accepted = useMemo(() => {
    const counts: Record<string, number> = {};
    risks.filter((r) => r.assessment === 'Accept').forEach((r) => {
      const a = assets.find((x) => x.id === r.assetId);
      if (a) counts[a.department] = (counts[a.department] || 0) + 1;
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
      <ChartCard title="Click a bar to filter Assets">
        <Bar
          data={{ labels: critKeys, datasets: [{ data: critKeys.map((k) => crit[k]), backgroundColor: ['#22c55e', '#eab308', '#ef4444'], borderRadius: 4 }] }}
          options={baseOptions('Asset Criticality Pipeline', (i) =>
            setGlobalFilter({ type: 'assetCriticality', value: critKeys[i], label: `Assets: ${critKeys[i]} Criticality` }))}
        />
      </ChartCard>

      <ChartCard title="Click a segment to filter Risks">
        <Doughnut
          data={{ labels: treatKeys, datasets: [{ data: treatKeys.map((k) => treat[k]), backgroundColor: ['#94a3b8', '#3b82f6', '#22c55e', '#ef4444'] }] }}
          options={{
            ...baseOptions('Risk Treatment Status', (i) => {
              const lbl = treatKeys[i];
              if (lbl === 'Overdue') setGlobalFilter({ type: 'riskOverdue', value: true, label: 'Overdue Risk Plans' });
              else setGlobalFilter({ type: 'riskStatus', value: lbl, label: `Risks: ${lbl} Status` });
            }),
            plugins: {
              legend: { display: true, position: 'bottom', labels: { boxWidth: 12 } },
              title: { display: true, text: 'Risk Treatment Status', color: '#0F172A' },
            },
          }}
        />
      </ChartCard>

      <ChartCard title="Click a bubble to filter Risks">
        <Bubble
          data={{ datasets: [{ data: heatData, backgroundColor: heatData.map((d) => d.bg) }] }}
          options={{
            ...baseOptions('Residual Heat Map', (i) =>
              setGlobalFilter({ type: 'riskHeat', value: { i: heatData[i].x, l: heatData[i].y }, label: `Risks: Impact ${heatData[i].x}, Likelihood ${heatData[i].y}` })),
            scales: {
              x: { title: { display: true, text: 'Impact' }, min: 0.5, max: 5.5, ticks: { stepSize: 1 } },
              y: { title: { display: true, text: 'Likelihood' }, min: 0.5, max: 5.5, ticks: { stepSize: 1 } },
            },
            plugins: {
              tooltip: { callbacks: { label: (ctx: any) => `I:${ctx.raw.x} L:${ctx.raw.y} - Count: ${ctx.raw.count}` } },
              legend: { display: false },
              title: { display: true, text: 'Residual Heat Map', color: '#0F172A' },
            },
          }}
        />
      </ChartCard>

      <ChartCard title="Click a bar to filter Risks">
        <Bar
          data={{ labels: deptKeys, datasets: [{ data: deptKeys.map((k) => dept[k]), backgroundColor: '#00B8D9', borderRadius: 4 }] }}
          options={baseOptions('Risks by Department', (i) =>
            setGlobalFilter({ type: 'riskDept', value: deptKeys[i], label: `Risks for Dept: ${deptKeys[i]}` }))}
        />
      </ChartCard>

      <ChartCard title="Click a bar to filter Risks">
        <Bar
          data={{
            labels: topThreats.map((t) => (t[0].length > 15 ? t[0].substring(0, 15) + '...' : t[0])),
            datasets: [{ data: topThreats.map((t) => t[1]), backgroundColor: '#8B5CF6', borderRadius: 4 }],
          }}
          options={{
            ...baseOptions('Top 5 Threats', (i) =>
              setGlobalFilter({ type: 'riskThreat', value: topThreats[i][0], label: `Risks: Threat - ${topThreats[i][0]}` })),
            indexAxis: 'y',
          }}
        />
      </ChartCard>

      <ChartCard title="Click a bar to filter Overdue Actions">
        <Bar
          data={{
            labels: overdueKeys.length ? overdueKeys : ['None'],
            datasets: [{ data: overdueKeys.length ? overdueKeys.map((k) => overdue[k]) : [0], backgroundColor: '#DC2626', borderRadius: 4 }],
          }}
          options={baseOptions('Overdue by Owner', (i) => {
            if (overdueKeys.length) setGlobalFilter({ type: 'riskOverdueOwner', value: overdueKeys[i], label: `Overdue Risks for ${overdueKeys[i]}` });
          })}
        />
      </ChartCard>

      <ChartCard title="Click a segment to filter Accepted Risks">
        <Pie
          data={{
            labels: acceptedKeys.length ? acceptedKeys : ['None'],
            datasets: [{ data: acceptedKeys.length ? acceptedKeys.map((k) => accepted[k]) : [1], backgroundColor: ['#f97316', '#fcd34d', '#fb923c', '#fdba74'] }],
          }}
          options={{
            ...baseOptions('Accepted Risks', (i) => {
              if (acceptedKeys.length) setGlobalFilter({ type: 'riskAcceptedDept', value: acceptedKeys[i], label: `Accepted Risks for Dept: ${acceptedKeys[i]}` });
            }),
            plugins: {
              legend: { display: true, position: 'right', labels: { boxWidth: 10 } },
              title: { display: true, text: 'Accepted Risks', color: '#0F172A' },
            },
          }}
        />
      </ChartCard>

      <ChartCard title="Click a bar to filter by Control gaps">
        <Bar
          data={{ labels: gapKeys, datasets: [{ data: gapKeys.map((k) => gap[k as keyof typeof gap]), backgroundColor: ['#ef4444', '#f97316', '#22c55e'], borderRadius: 4 }] }}
          options={baseOptions('Control Coverage Gaps', (i) =>
            setGlobalFilter({ type: 'riskControlCount', value: i as 0 | 1 | 2, label: `Risks with ${gapKeys[i]}` }))}
        />
      </ChartCard>
    </div>
  );
}
