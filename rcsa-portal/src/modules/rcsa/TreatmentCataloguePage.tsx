import { useMemo, useState } from 'react';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import { PageHeader } from './PageHeader';
import { Badge } from '../../components/common/Badge';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { RowActions } from '../../components/common/RowActions';
import { treatmentStatus, statusBadgeClass } from '../../domain/scoring';

const STATUS_OPTIONS = ['', 'Open', 'In Progress', 'Completed', 'Overdue'] as const;
const ctl = 'border rounded px-2 py-1.5 text-sm bg-white';

// Treatment Catalogue — every mitigation action, with its own filters and add.
export function TreatmentCataloguePage() {
  const store = useStore();
  const modals = useModals();
  const perms = usePermissions('treatment-catalogue');
  const riskPerms = usePermissions('risk-catalogue');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.treatments.filter((t) => {
      if (status && treatmentStatus(t) !== status) return false;
      if (q) {
        const text = `${t.id} ${t.title} ${t.owner} ${t.description} ${t.riskIds.join(' ')}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [store.treatments, search, status]);

  const pager = usePaged(filtered);

  return (
    <>
      <PageHeader>
        {perms.create && <button onClick={() => modals.newTreatment()} className="bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold shadow">+ New Treatment</button>}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-semibold text-gray-800">Treatment Register</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${ctl} w-56`}
                placeholder="Search title, owner, risk…"
              />
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={ctl}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
              </select>
              <span className="text-xs text-gray-500">{filtered.length} treatment{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Treatment #</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Risks</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Due</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No treatments match criteria.</td></tr>
                ) : (
                  pager.pageItems.map((t) => {
                    const st = treatmentStatus(t);
                    return (
                      <tr key={t.id} className="risk-row">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 font-semibold">{t.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px]">{t.title || 'Untitled'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {t.riskIds.map((id) =>
                              riskPerms.edit ? (
                                <span key={id} onClick={() => modals.editRisk(id)} className="font-mono text-xs text-blue-600 font-semibold hover:underline cursor-pointer">{id}</span>
                              ) : (
                                <span key={id} className="font-mono text-xs text-gray-500 font-semibold">{id}</span>
                              ),
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{t.owner || 'Unassigned'}</td>
                        <td className="px-4 py-3 text-sm">{t.dueDate || 'N/A'}</td>
                        <td className="px-4 py-3"><Badge className={statusBadgeClass(st)}>{st}</Badge></td>
                        <td className="px-4 py-3">
                          <RowActions onEdit={perms.edit ? () => modals.editTreatment(t.id) : undefined} onDelete={perms.remove ? () => modals.deleteTreatmentFlow(t.id) : undefined} editLabel="Edit treatment" deleteLabel="Delete treatment" />
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
        </div>
      </div>
    </>
  );
}
