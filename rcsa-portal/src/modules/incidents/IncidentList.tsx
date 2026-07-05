import { useMemo, useState } from 'react';
import { Pill } from '../../components/common/Pill';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { RowActions } from '../../components/common/RowActions';
import {
  INCIDENT_STATUSES,
  SEVERITY_RANK,
  severityColor,
  statusColor,
  categoryLabel,
  type Incident,
} from './types';

type SortKey = 'id' | 'reportedAt' | 'severity' | 'status';
const th = 'text-left px-3 py-3 text-[10.5px] font-semibold tracking-wide uppercase whitespace-nowrap';

const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { year: '2-digit', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: '2-digit' }) : '—');

interface Props {
  incidents: Incident[]; // already filtered by the page-level slicer
  canEdit: boolean;
  canRemove: boolean;
  onView: (i: Incident) => void;
  onEdit: (i: Incident) => void;
  onDelete: (i: Incident) => void;
}

export function IncidentList({ incidents, canEdit, canRemove, onView, onEdit, onDelete }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'reportedAt', dir: 'desc' });

  const rows = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...incidents].sort((a, b) => {
      let c = 0;
      if (sort.key === 'severity') c = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      else if (sort.key === 'status') c = INCIDENT_STATUSES.indexOf(a.status) - INCIDENT_STATUSES.indexOf(b.status);
      else if (sort.key === 'reportedAt') c = a.reportedAt < b.reportedAt ? -1 : a.reportedAt > b.reportedAt ? 1 : 0;
      else c = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      return c * dir;
    });
  }, [incidents, sort]);

  const pager = usePaged(rows);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  const caret = (key: SortKey) => (sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const sortable = (key: SortKey, label: string) => (
    <th className={`${th} cursor-pointer select-none`} onClick={() => toggleSort(key)}>{label}{caret(key)}</th>
  );

  return (
    <div className="section-card">
      <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-2">
        <h2 className="text-base font-semibold text-gray-800">Incident Register</h2>
        <span className="text-xs text-gray-500">{incidents.length} incident{incidents.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              {sortable('id', 'ID')}
              <th className={th}>Short Description</th>
              {sortable('reportedAt', 'Time Reported')}
              <th className={th}>Incident Time</th>
              <th className={th}>Reported By</th>
              <th className={th}>Category</th>
              {sortable('severity', 'Severity')}
              <th className={th}>Asset</th>
              {sortable('status', 'Status')}
              <th className={th}>Responsible</th>
              <th className={th}>Closure</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pager.pageItems.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-gray-400">No incidents match the filters.</td></tr>
            ) : (
              pager.pageItems.map((i) => (
                <tr key={i.id} className="risk-row cursor-pointer" onClick={() => onView(i)}>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{i.id}</td>
                  <td className="px-3 py-3 font-medium text-gray-800 max-w-[240px] truncate" title={i.shortDesc}>{i.shortDesc}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(i.reportedAt)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(i.occurredAt)}</td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap">{i.reportedBy}</td>
                  <td className="px-3 py-3 text-sm max-w-[160px] truncate" title={categoryLabel(i)}>{categoryLabel(i)}</td>
                  <td className="px-3 py-3"><Pill text={i.severity} k={severityColor(i.severity)} /></td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap">{i.asset}</td>
                  <td className="px-3 py-3"><Pill text={i.status} k={statusColor(i.status)} /></td>
                  <td className="px-3 py-3 text-sm whitespace-nowrap">{i.responsible || 'Unassigned'}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(i.closedAt)}</td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-xs">
                      <button onClick={() => onView(i)} className="text-blue-600 hover:underline">View</button>
                      {(canEdit || canRemove) && <RowActions onEdit={canEdit ? () => onEdit(i) : undefined} onDelete={canRemove ? () => onDelete(i) : undefined} editLabel="Edit incident" deleteLabel="Delete incident" />}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} start={pager.start} onPage={pager.setPage} onPageSize={pager.setPageSize} />
    </div>
  );
}
