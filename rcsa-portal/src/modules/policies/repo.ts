import { createLocalRepo } from '../../data/createLocalRepo';
import type { PolicyDoc } from './types';
import { SEED_POLICIES } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const policyRepo = createLocalRepo<PolicyDoc>({
  key: 'infosec.policies.v2',
  seed: SEED_POLICIES,
  idPrefix: 'POL',
  pad: 2,
  entity: 'Document',
  describe: (d) => d.title,
});
