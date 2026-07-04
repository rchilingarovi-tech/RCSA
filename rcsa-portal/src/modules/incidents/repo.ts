import { createLocalRepo } from '../../data/createLocalRepo';
import type { Incident } from './types';
import { SEED_INCIDENTS } from './seed';

export const incidentRepo = createLocalRepo<Incident>({
  key: 'infosec.incidents.v1',
  seed: SEED_INCIDENTS,
  idPrefix: 'INC',
  pad: 3,
  entity: 'Incident',
  describe: (i) => `${i.id} — ${i.shortDesc}`,
});
