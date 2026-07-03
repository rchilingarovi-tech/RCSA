import { createLocalRepo } from '../../data/createLocalRepo';
import type { Meeting } from './types';
import { SEED_MEETINGS } from './seed';

export const committeeRepo = createLocalRepo<Meeting>({
  key: 'infosec.committee.v1',
  seed: SEED_MEETINGS,
  idPrefix: 'MTG',
  pad: 2,
  entity: 'Meeting',
  describe: (m) => m.title,
});
