import type { RcsaRepository } from './repository';
import { LocalStorageRepo } from './localStorageRepo';

// Single swap point: replace LocalStorageRepo with an API-backed implementation
// to move off the in-browser mock without touching any component.
export const repo: RcsaRepository = new LocalStorageRepo();

export type { RcsaRepository } from './repository';
export type * from './models';
