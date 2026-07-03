import { createLocalRepo } from '../../data/createLocalRepo';
import type { PolicyDoc } from './types';
import { SEED_POLICIES } from './seed';

export const policyRepo = createLocalRepo<PolicyDoc>({
  key: 'infosec.policies.v1',
  seed: SEED_POLICIES,
  idPrefix: 'POL',
  pad: 2,
  entity: 'Document',
  describe: (d) => d.title,
});
