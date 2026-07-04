import { createLocalRepo } from '../../data/createLocalRepo';
import type { Initiative } from './types';
import { SEED_INITIATIVES } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const planRepo = createLocalRepo<Initiative>({
  key: 'infosec.plan.v2',
  seed: SEED_INITIATIVES,
  idPrefix: 'INI',
  pad: 2,
  entity: 'Initiative',
  describe: (i) => i.initiative,
});
