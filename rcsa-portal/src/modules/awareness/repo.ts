import { createLocalRepo } from '../../data/createLocalRepo';
import type { Course } from './types';
import { SEED_COURSES } from './seed';

export const awarenessRepo = createLocalRepo<Course>({
  key: 'infosec.awareness.v1',
  seed: SEED_COURSES,
  idPrefix: 'TRN',
  pad: 2,
  entity: 'Course',
  describe: (c) => c.name,
});
