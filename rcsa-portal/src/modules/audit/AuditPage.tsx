import { useEffect, useMemo, useState } from 'react';
import { Pill } from '../../components/common/Pill';
import { PageHeader } from '../rcsa/PageHeader';
import { useUi } from '../../components/common/UiProvider';
import { usePermissions } from '../../auth/usePermissions';
import { auditLog, type AuditAction, type AuditEvent } from '../../audit/auditLog';

const th = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase';

const ACTION_COLOR: Record<AuditAction, string> = {
  create: 'low',
  update: 'info',
  delete: 'crit',
  reset: 'high',
  rights: 'med',
  session: 'mut',
};
const ACTION_FILTERS: ('all' | AuditAction)[] = ['all', 'create', 'update', 'delete', 'rights', 'reset', 'session'];

export function AuditPage() {
  const ui = useUi();
  const perms = usePermissions('audit-log');
  const [events, setEvents] = useState<AuditEvent[]>(() => auditLog.list());
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<'all' | AuditAction>('all');

  // Live-refresh as events are recorded elsewhere in the app.
  useEffect(() => auditLog.subscribe(() => setEvents(auditLog.list())), []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (action !== 'all' && e.action !== action) return false;
      if (q && !`${e.actor} ${e.entity} ${e.entityId} ${e.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, search, action]);

  const fmt = (ts: string) => {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? ts : d.toLocaleString();
  };

  return (
    <>
      <PageHeader>
        {perms.remove && (
          <button
            onClick={() => ui.confirm('Clear audit log?', 'Permanently removes all recorded events. (In production this log is append-only and cannot be cleared.)', () => { auditLog.reset(); ui.toast('Audit log cleared', 'bg-red-700'); })}
            className="btn-neutral bg-white border px-3 py-2 rounded text-sm"
          >
            Clear log
          </button>
        )}
      </PageHeader>

      <div className="p-6 space-y-4">
        <div className="section-card">
          <div className="px-5 py-3 border-b bg-gray-50 flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold text-gray-800">Audit Trail</h2>
            <span className="text-xs text-gray-500">{rows.length} of {events.length} events</span>
            <div className="flex-1" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, entity, summary…"
              className="border rounded px-2 py-1.5 text-sm w-56"
            />
            <select value={action} onChange={(e) => setAction(e.target.value as 'all' | AuditAction)} className="border rounded px-2 py-1.5 text-sm">
              {ACTION_FILTERS.map((a) => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 text-gray-600">
                <tr>
                  <th className={th}>Time</th>
                  <th className={th}>Actor</th>
                  <th className={th}>Action</th>
                  <th className={th}>Entity</th>
                  <th className={th}>Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No events recorded yet — create, edit or delete something to see it logged here.</td></tr>
                ) : (
                  rows.map((e) => (
                    <tr key={e.id} className="risk-row">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--text3)' }}>{fmt(e.ts)}</td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text)' }}>{e.actor}</td>
                      <td className="px-4 py-3"><Pill text={e.action} k={ACTION_COLOR[e.action]} /></td>
                      <td className="px-4 py-3 text-gray-500">{e.entity}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text2)' }}>
                        <div>{e.summary}</div>
                        {e.changes && e.changes.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-semibold" style={{ color: 'var(--link)' }}>
                              {e.changes.length} field{e.changes.length === 1 ? '' : 's'} {e.action === 'create' ? 'set' : e.action === 'delete' ? 'removed' : 'changed'}
                            </summary>
                            <div className="mt-1.5 space-y-1">
                              {e.changes.map((c) => (
                                <div key={c.field} className="text-[11.5px] font-mono flex flex-wrap items-baseline gap-1.5">
                                  <span className="font-semibold" style={{ color: 'var(--text)' }}>{c.field}:</span>
                                  <span className="px-1 rounded line-through" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>{c.from}</span>
                                  <span style={{ color: 'var(--text3)' }}>→</span>
                                  <span className="px-1 rounded" style={{ background: 'var(--low-bg)', color: 'var(--low)' }}>{c.to}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
