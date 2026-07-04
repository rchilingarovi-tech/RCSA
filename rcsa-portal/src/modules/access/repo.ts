import { createLocalRepo } from '../../data/createLocalRepo';
import type { AccessReview } from './types';
import { SEED_ACCESS } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const accessRepo = createLocalRepo<AccessReview>({
  key: 'infosec.access.v2',
  seed: SEED_ACCESS,
  idPrefix: 'ACR',
  pad: 2,
  entity: 'Access review',
  describe: (r) => r.campaign,
});
