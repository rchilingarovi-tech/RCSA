import { createLocalRepo } from '../../data/createLocalRepo';
import type { Meeting } from './types';
import { SEED_MEETINGS } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const committeeRepo = createLocalRepo<Meeting>({
  key: 'infosec.committee.v2',
  seed: SEED_MEETINGS,
  idPrefix: 'MTG',
  pad: 2,
  entity: 'Meeting',
  describe: (m) => m.title,
});
