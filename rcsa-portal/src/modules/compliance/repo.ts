import { createLocalRepo } from '../../data/createLocalRepo';
import type { ComplianceControl } from './types';
import { SEED_CONTROLS } from './seed';

export const complianceRepo = createLocalRepo<ComplianceControl>({
  key: 'infosec.compliance.v1',
  seed: SEED_CONTROLS,
  idPrefix: 'CTL',
  pad: 3,
  entity: 'Control',
  describe: (c) => `${c.ref} — ${c.title}`,
});
