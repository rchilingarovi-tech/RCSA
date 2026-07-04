import { createLocalRepo } from '../../data/createLocalRepo';
import type { Kpi } from './types';
import { SEED_KPIS } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const kpiRepo = createLocalRepo<Kpi>({
  key: 'infosec.kpis.v2',
  seed: SEED_KPIS,
  idPrefix: 'KPI',
  pad: 2,
  entity: 'KPI',
  describe: (k) => k.name,
});
