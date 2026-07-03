import { createLocalRepo } from '../../data/createLocalRepo';
import type { Vendor } from './types';
import { SEED_VENDORS } from './seed';

export const vendorRepo = createLocalRepo<Vendor>({
  key: 'infosec.vendors.v1',
  seed: SEED_VENDORS,
  idPrefix: 'VEN',
  pad: 2,
  entity: 'Vendor',
  describe: (v) => v.name,
});
