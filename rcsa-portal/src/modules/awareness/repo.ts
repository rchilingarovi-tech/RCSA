import { createLocalRepo } from '../../data/createLocalRepo';
import type { Course } from './types';
import { SEED_COURSES } from './seed';

// New storage key (v2) — reference model replaces the previous one (accepted data loss).
export const awarenessRepo = createLocalRepo<Course>({
  key: 'infosec.awareness.v2',
  seed: SEED_COURSES,
  idPrefix: 'TRN',
  pad: 2,
  entity: 'Course',
  describe: (c) => c.course,
});
