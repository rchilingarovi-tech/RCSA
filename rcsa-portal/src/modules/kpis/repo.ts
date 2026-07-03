import { createLocalRepo } from '../../data/createLocalRepo';
import type { Kpi } from './types';
import { SEED_KPIS } from './seed';

export const kpiRepo = createLocalRepo<Kpi>({
  key: 'infosec.kpis.v1',
  seed: SEED_KPIS,
  idPrefix: 'KPI',
  pad: 2,
  entity: 'KPI',
  describe: (k) => k.name,
});
