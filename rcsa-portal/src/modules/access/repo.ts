import { createLocalRepo } from '../../data/createLocalRepo';
import type { AccessReview } from './types';
import { SEED_ACCESS } from './seed';

export const accessRepo = createLocalRepo<AccessReview>({
  key: 'infosec.access.v1',
  seed: SEED_ACCESS,
  idPrefix: 'ACR',
  pad: 2,
  entity: 'Access review',
  describe: (r) => r.name,
});
