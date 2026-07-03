import { createLocalRepo } from '../../data/createLocalRepo';
import type { Initiative } from './types';
import { SEED_INITIATIVES } from './seed';

export const planRepo = createLocalRepo<Initiative>({
  key: 'infosec.plan.v1',
  seed: SEED_INITIATIVES,
  idPrefix: 'INI',
  pad: 2,
  entity: 'Initiative',
  describe: (i) => i.name,
});
