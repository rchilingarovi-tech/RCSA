import { createLocalRepo } from '../../data/createLocalRepo';
import type { Vuln } from './types';
import { SEED_VULNS } from './seed';

export const vulnRepo = createLocalRepo<Vuln>({
  key: 'infosec.vulns.v1',
  seed: SEED_VULNS,
  idPrefix: 'VUL',
  pad: 2,
  entity: 'Vulnerability',
  describe: (v) => `${v.id} — ${v.title}`,
  // Exploit details / fix plans are sensitive — keep their content out of the
  // audit trail (it still records that the fields changed).
  auditRedact: ['description', 'remediation'],
});
