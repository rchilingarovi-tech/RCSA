import { Pill } from '../../components/common/Pill';
import { useTableSort } from '../../components/common/useTableSort';
import { Pagination, usePaged } from '../../components/common/Pagination';
import { RowActions } from '../../components/common/RowActions';
import { rowActivation } from '../../lib/a11y';
import {
  INCIDENT_STATUSES,
  SEVERITY_RANK,
  severityColor,
  statusColor,
  statusLabel,
  categoryLabel,
  daysOpen,
  type Incident,
} from './types';

const th ='text-left px-3 py-3 text-[10.5px] font-semibold tracking-wide uppercase whitespace-nowrap';

const fmtDateTime = (s: string) => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { year: '2-digit', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

interface Props {
  incidents: Incident[]; // already filtered by the page-level slicer
  canEdit: boolean;
  canRemove: boolean;
  onView: (i: Incident) => void;
  onEdit: (i: Incident) => void;
  onDelete: (i: Incident) => void;
}

export function IncidentList({ incidents, canEdit, canRemove, onView, onEdit, onDelete }: Props) {
  const { rows, sortable } = useTableSort<Incident>(
    incidents,
    {
      id: (r) => r.id,
      reportedAt: (r) => r.reportedAt,
      severity: (r) => SEVERITY_RANK[r.severity],
      status: (r) => INCIDENT_STATUSES.indexOf(r.status),
    },
    { key: 'reportedAt', dir: 'desc' },
    th,
  );

  const pager = usePaged(rows);

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
              <th className={`${th} hidden sm:table-cell`}>Category</th>
              {sortable('reportedAt', 'Time Reported', 'hidden md:table-cell')}
              {sortable('severity', 'Severity')}
              {sortable('status', 'Status')}
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pager.pageItems.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No incidents match the filters.</td></tr>
            ) : (
              pager.pageItems.map((i) => (
                <tr key={i.id} className="risk-row cursor-pointer" {...rowActivation(() => onView(i), `Open ${i.id}: ${i.shortDesc}`)}>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 font-semibold whitespace-nowrap">{i.id}</td>
                  <td className="px-3 py-3 font-medium text-gray-800 max-w-[220px] sm:max-w-[340px] truncate" title={i.shortDesc}>{i.shortDesc}</td>
                  <td className="px-3 py-3 text-sm max-w-[160px] truncate hidden sm:table-cell" title={categoryLabel(i)}>{categoryLabel(i)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap hidden md:table-cell">{fmtDateTime(i.reportedAt)}</td>
                  <td className="px-3 py-3"><Pill text={i.severity} k={severityColor(i.severity)} /></td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Pill text={statusLabel(i.status)} k={statusColor(i.status)} />
                      {(() => {
                        // Aging chip — surfaces the oldest open incidents for faster triage.
                        const age = daysOpen(i);
                        if (age == null || age < 7) return null;
                        const k = age >= 30 ? 'crit' : 'med';
                        return <span title={`Open ${age} days`} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: `var(--${k}-bg)`, color: `var(--${k})` }}>{age}d</span>;
                      })()}
                    </span>
                  </td>
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
