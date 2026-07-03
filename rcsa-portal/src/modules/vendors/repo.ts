import { createLocalRepo } from '../../data/createLocalRepo';
import type { Vendor } from './types';
import { SEED_VENDORS } from './seed';

// New storage key (v2) — the reference model replaces the previous one; old v1
// records are intentionally not migrated (accepted data loss for this module).
export const vendorRepo = createLocalRepo<Vendor>({
  key: 'infosec.vendors.v2',
  seed: SEED_VENDORS,
  idPrefix: 'VEN',
  pad: 2,
  entity: 'Vendor',
  describe: (v) => v.name,
});
