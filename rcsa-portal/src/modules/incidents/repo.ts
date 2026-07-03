import { createLocalRepo } from '../../data/createLocalRepo';
import type { Incident } from './types';
import { SEED_INCIDENTS } from './seed';

// New storage key (v2) — the reference model replaces the previous one; old v1
// records are intentionally not migrated (accepted data loss for this module).
export const incidentRepo = createLocalRepo<Incident>({
  key: 'infosec.incidents.v2',
  seed: SEED_INCIDENTS,
  idPrefix: 'INC',
  pad: 3,
  entity: 'Incident',
  describe: (i) => `${i.id} — ${i.title}`,
});
