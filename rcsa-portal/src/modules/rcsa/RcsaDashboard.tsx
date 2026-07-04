import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { useUi } from '../../components/common/UiProvider';
import { useNav } from '../../state/NavContext';
import { PageHeader } from './PageHeader';
import { KpiCards } from '../../components/KpiCards';
import { DashboardCharts } from '../../components/charts/DashboardCharts';
import { DashboardSlicer } from './DashboardSlicer';
import { ActiveFilterBar } from './ActiveFilterBar';
import { RiskTable } from '../../components/risks/RiskTable';
import { getDashboardScope } from '../../state/filters';
import { auditLog } from '../../audit/auditLog';

const ACTION_DOT: Record<string, string> = { create: 'low', update: 'info', delete: 'crit', reset: 'high', rights: 'med', session: 'mut' };
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

// RCSA landing — one cross-filter. The Asset Filters + any chart click slice the
// whole dashboard together; the matching risks (the actionable RCSA unit) show
// below, with the affected asset as context.
export function RcsaDashboard() {
  const store = useStore();
  const modals = useModals();
  const ui = useUi();
  const nav = useNav();
  const perms = usePermissions('rcsa-dashboard');
  const auditPerms = usePermissions('audit-log');
  const [events, setEvents] = useState(() => auditLog.list().slice(0, 6));
  useEffect(() => auditLog.subscribe(() => setEvents(auditLog.list().slice(0, 6))), []);

  const scope = useMemo(
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

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => modals.openImport()} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Import from CSV</button>}
        {perms.export && <button onClick={() => modals.openExport()} className="btn-neutral bg-white border px-3 py-2 rounded text-sm">Export to CSV</button>}
        {perms.remove && (
          <button
            onClick={() =>
              ui.confirm('Reset demo data?', 'This restores the original sample assets and risks and discards your changes.', () => {
                void store.resetDemoData();
                store.clearGlobalFilter();
                ui.toast('Demo data restored', 'bg-green-700');
              })
            }
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Reset demo data
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <DashboardSlicer />
        <ActiveFilterBar />
        <DashboardCharts />
        <KpiCards />

        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-gray-800">Matching Risks</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">{scope.risks.length} risk{scope.risks.length !== 1 ? 's' : ''}</span>
              <button onClick={() => nav.navigate('risk-catalogue')} className="btn-neutral bg-white border px-3 py-1.5 rounded text-xs">Open in Risk Catalogue →</button>
            </div>
          </div>
          <RiskTable risks={scope.risks} />
        </div>

        {auditPerms.view && (
          <div className="section-card">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-800">Recent Activity</h2>
              <button onClick={() => nav.navigate('audit-log')} className="btn-neutral bg-white border px-3 py-1.5 rounded text-xs">View audit log →</button>
            </div>
            {events.length === 0 ? (
              <div className="px-5 py-6 text-sm" style={{ color: 'var(--text3)' }}>No recent activity yet.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
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
          </div>
        )}
      </div>
    </>
  );
}
