import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { Badge } from '../common/Badge';
import { Pagination, usePaged } from '../common/Pagination';
import { RowActions } from '../common/RowActions';
import { inherentScore, residualScore, riskLevel, riskStatus, statusBadgeClass } from '../../domain/scoring';
import type { Risk } from '../../data/models';

// Shared risk table — used by the Risk Catalogue and the Dashboard drill-down.
export function RiskTable({ risks }: { risks: Risk[] }) {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('risk-catalogue');
  const assetName = (id: string) => store.assets.find((a) => a.id === id)?.name ?? id;
  const pager = usePaged(risks);

  return (
    <>
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-4 py-3 text-left">Risk #</th>
            <th className="px-4 py-3 text-left">Asset</th>
            <th className="px-4 py-3 text-left">Threat</th>
            <th className="px-4 py-3 text-left">Vulnerability</th>
            <th className="px-4 py-3 text-left">Owner</th>
            <th className="px-4 py-3 text-center">Inherent</th>
            <th className="px-4 py-3 text-center">Residual</th>
            <th className="px-4 py-3 text-left">Decision</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {risks.length === 0 ? (
            <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-400">No risks match criteria.</td></tr>
          ) : (
            pager.pageItems.map((r) => {
              const inScore = inherentScore(r);
              const resScore = residualScore(r);
              const inL = riskLevel(inScore);
              const resL = resScore == null ? null : riskLevel(resScore);
              const status = riskStatus(r, store.treatments);
              return (
                <tr key={r.id} className="risk-row">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold">{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.assetIds.map((id) => (
                        <span
                          key={id}
                          onClick={() => modals.openSummary(id)}
                          title={assetName(id)}
                          className="font-mono text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px]">{r.threat}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px]">{r.vuln}</td>
                  <td className="px-4 py-3 text-sm">{r.owner}</td>
                  <td className="px-4 py-3 text-center"><Badge className={inL[1]}>{inScore}<br /><span className="font-normal">{inL[0]}</span></Badge></td>
                  <td className="px-4 py-3 text-center">{resScore == null || resL == null ? <span className="text-xs text-gray-400">Not assessed</span> : <Badge className={resL[1]}>{resScore}<br /><span className="font-normal">{resL[0]}</span></Badge>}</td>
                  <td className="px-4 py-3"><span className="font-semibold text-sm">{r.assessment}</span></td>
                  <td className="px-4 py-3"><Badge className={statusBadgeClass(status)}>{status}</Badge></td>
                  <td className="px-4 py-3">
                    <RowActions onEdit={perms.edit ? () => modals.editRisk(r.id) : undefined} onDelete={perms.remove ? () => modals.deleteRiskFlow(r.id) : undefined} editLabel="Edit risk" deleteLabel="Delete risk" />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    <Pagination
      page={pager.page}
      pageCount={pager.pageCount}
      pageSize={pager.pageSize}
      total={pager.total}
      start={pager.start}
      onPage={pager.setPage}
      onPageSize={pager.setPageSize}
    />
    </>
  );
}
