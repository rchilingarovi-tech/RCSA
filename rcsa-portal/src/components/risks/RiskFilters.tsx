import { useStore } from '../../state/AppStore';
import type { RiskFilters as Filters } from '../../state/filters';

export function RiskFilters() {
  const store = useStore();
  const f = store.riskFilters;
  const ctl = 'border rounded px-2 py-1.5 text-sm bg-white';

  return (
    <>
      <select value={f.level} onChange={(e) => store.patchRiskFilters({ level: e.target.value as Filters['level'] })} className={ctl} aria-label="Risk level filter">
        <option value="">All levels</option>
        <option>Low</option>
        <option>Medium</option>
        <option>High</option>
        <option>Critical</option>
      </select>
      <select value={f.status} onChange={(e) => store.patchRiskFilters({ status: e.target.value as Filters['status'] })} className={ctl} aria-label="Risk status filter">
        <option value="">All status</option>
        <option>Open</option>
        <option>In Progress</option>
        <option>Completed</option>
        <option>Overdue</option>
      </select>
      <select value={f.assessment} onChange={(e) => store.patchRiskFilters({ assessment: e.target.value as Filters['assessment'] })} className={ctl} aria-label="Risk decision filter">
        <option value="">All decisions</option>
        <option>Mitigate</option>
        <option>Accept</option>
        <option>Transfer</option>
        <option>Avoid</option>
      </select>
    </>
  );
}
