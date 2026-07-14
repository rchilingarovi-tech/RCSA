import { createLocalRepo } from '../../data/createLocalRepo';
import type { Finding } from './types';
import { SEED_FINDINGS } from './seed';

export const findingsRepo = createLocalRepo<Finding>({
  key: 'infosec.findings.v1',
  seed: SEED_FINDINGS,
  idPrefix: 'FND',
  pad: 2,
  entity: 'Finding',
  describe: (f) => `${f.id} — ${f.title}`,
  // Finding narratives / remediation plans are confidential — keep their content
  // out of the audit trail (it still records that the fields changed).
  auditRedact: ['description', 'actionPlan'],
});
