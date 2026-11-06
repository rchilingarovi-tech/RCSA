// REGRESSION — confirmed data-loss defect #1: ID collision after a delete.
//
// The Asset / Risk / Treatment create modals allocate ids with
//   genId(prefix, store.<collection>)        (domain/scoring.ts)
// which is based on the collection LENGTH. Saving is an upsert by id
// (LocalStorageRepo.save*), so after deleting any record other than the last,
// the next "new" record reuses the id of an existing one and silently
// REPLACES it.
//
// Each scenario drives the same calls the modals make (genId on the current
// list, then repo.save*) against the real LocalStorageRepo + seed data, and is
// declared as a known-defect spec (see src/test/helpers.ts):
//   invariants  scenario really ran; deleted record gone; the new record is
//               persisted exactly once, exactly as created (true before AND
//               after a fix — checked first, never bypassable)
//   correct     fresh id, every survivor unchanged, collection grew by one
//               (does not assume HOW ids are allocated)
//   documented  the exact damage today: { reusedId, lostRecords, growth }
// A separate block proves a correct allocator passes every check.
import { describe, expect, it } from 'vitest';
import { LocalStorageRepo } from '../../data/localStorageRepo';
import { createLocalRepo } from '../../data/createLocalRepo';
import { genId } from '../../domain/scoring';
import type { Asset, Risk, Treatment } from '../../data/models';
import { knownDefect, type DefectSpec } from '../helpers';

/** Id allocator signature — the app's is `genId`; tests can supply a corrected one. */
type Alloc = (prefix: string, list: { id: string }[]) => string;

/** A CORRECT allocator (highest existing number + 1) — used only to prove the
 *  known-defect invariants are satisfiable by a real fix (no masking). */
const maxPlusOne: Alloc = (prefix, list) => {
  const max = list.reduce((m, x) => Math.max(m, Number(x.id.replace(/\D/g, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};

/** Create a record the way the "New …" modal does, after deleting one from the middle. */
interface Scenario<T extends { id: string }> {
  before: T[]; // collection before the delete
  deleted: T; // the record removed
  created: T; // the record the user just created
  after: T[]; // collection after the create
}

async function assetScenario(alloc: Alloc = genId): Promise<Scenario<Asset>> {
  const repo = new LocalStorageRepo();
  const before = await repo.listAssets();
  const deleted = before[Math.floor(before.length / 2)];
  await repo.deleteAsset(deleted.id);
  const list = await repo.listAssets();
  const created: Asset = { ...before[0], id: alloc('AST', list), name: 'Brand-new asset (test)' };
  await repo.saveAsset(created);
  return { before, deleted, created, after: await repo.listAssets() };
}

async function riskScenario(alloc: Alloc = genId): Promise<Scenario<Risk>> {
  const repo = new LocalStorageRepo();
  const before = await repo.listRisks();
  const deleted = before[Math.floor(before.length / 2)];
  await repo.deleteRisk(deleted.id);
  const list = await repo.listRisks();
  const created: Risk = { ...before[0], id: alloc('RSK', list), threat: 'Brand-new risk (test)' };
  await repo.saveRisk(created);
  return { before, deleted, created, after: await repo.listRisks() };
}

async function treatmentScenario(alloc: Alloc = genId): Promise<Scenario<Treatment>> {
  const repo = new LocalStorageRepo();
  // NB: treatments must be read before risks on a fresh store, otherwise the
  // repo's legacy-migration path runs and returns an empty treatment set.
  const before = await repo.listTreatments();
  const deleted = before[Math.floor(before.length / 2)];
  await repo.deleteTreatment(deleted.id);
  const list = await repo.listTreatments();
  const created: Treatment = { ...before[0], id: alloc('TRT', list), title: 'Brand-new treatment (test)' };
  await repo.saveTreatment(created);
  return { before, deleted, created, after: await repo.listTreatments() };
}

const survivorsOf = <T extends { id: string }>(s: Scenario<T>) => s.before.filter((x) => x.id !== s.deleted.id);

/**
 * Scenario invariants — true BOTH with today's bug AND after a correct fix, so
 * they are checked first and can never be bypassed by a later failure:
 *   • the scenario really deleted a record that existed, and it is gone;
 *   • the new record is persisted, exactly once, exactly as created.
 */
function expectScenarioInvariants<T extends { id: string }>(s: Scenario<T>): void {
  expect(s.before.length, 'fixture has records to delete from').toBeGreaterThan(2);
  expect(s.before.some((x) => x.id === s.deleted.id), 'deleted record existed').toBe(true);
  expect(s.after.some((x) => x.id === s.deleted.id), 'deleted record is gone').toBe(false);
  expect(s.after.filter((x) => x.id === s.created.id), 'new record persisted exactly once, unchanged').toEqual([s.created]);
}

/** What a correct create-after-delete must satisfy (fails today). */
function expectNoOverwrite<T extends { id: string }>(s: Scenario<T>): void {
  const survivors = survivorsOf(s);
  // The new record's id must be fresh (not any id that existed before the delete).
  expect(s.before.map((x) => x.id)).not.toContain(s.created.id);
  // Every surviving record is still there, unchanged.
  for (const x of survivors) expect(s.after.find((y) => y.id === x.id)).toEqual(x);
  // And the collection grew by exactly the new record.
  expect(s.after).toHaveLength(survivors.length + 1);
}

/** The observed damage, in a form that can be compared exactly. */
function collisionSymptom<T extends { id: string }>(s: Scenario<T>) {
  const survivors = survivorsOf(s);
  return {
    reusedId: s.before.some((x) => x.id === s.created.id) ? s.created.id : null,
    lostRecords: survivors
      .filter((x) => JSON.stringify(s.after.find((y) => y.id === x.id)) !== JSON.stringify(x))
      .map((x) => x.id),
    growth: s.after.length - survivors.length,
  };
}

function collisionDefect<T extends { id: string }>(
  scenario: () => Promise<Scenario<T>>,
  lastSeedId: string,
): DefectSpec<Scenario<T>> {
  return {
    observe: scenario,
    invariants: expectScenarioInvariants,
    correct: expectNoOverwrite,
    symptom: collisionSymptom,
    // Exactly today's damage: the new record took the LAST seed record's id,
    // that record was overwritten (lost), and the collection did not grow.
    documented: { reusedId: lastSeedId, lostRecords: [lastSeedId], growth: 0 },
  };
}

// ── Fixture facts (ordinary tests; true before and after any fix) ────────────
describe('ID collision — fixture', () => {
  it('fresh seed: 100 assets, and risk/treatment sets large enough to delete from the middle', async () => {
    const repo = new LocalStorageRepo();
    expect(await repo.listAssets()).toHaveLength(100);
    expect((await repo.listTreatments()).length).toBeGreaterThan(2);
    expect((await repo.listRisks()).length).toBeGreaterThan(2);
  });

  it('the last seed ids are AST-100, RSK-204 and TRT-195 (referenced by the documented symptoms)', async () => {
    const repo = new LocalStorageRepo();
    const last = <T extends { id: string }>(xs: T[]) => xs[xs.length - 1].id;
    expect(last(await repo.listAssets())).toBe('AST-100');
    expect(last(await repo.listTreatments())).toBe('TRT-195'); // treatments before risks — see treatmentScenario
    expect(last(await repo.listRisks())).toBe('RSK-204');
  });
});

// ── Known defects ────────────────────────────────────────────────────────────
describe('ID collision after deleting a record', () => {
  knownDefect('creating a new asset after a delete does not reuse an existing asset id', collisionDefect(() => assetScenario(), 'AST-100'));
  knownDefect('creating a new risk after a delete does not reuse an existing risk id', collisionDefect(() => riskScenario(), 'RSK-204'));
  knownDefect('creating a new treatment after a delete does not reuse an existing treatment id', collisionDefect(() => treatmentScenario(), 'TRT-195'));
});

describe('ID collision — a correct fix satisfies every known-defect check', () => {
  // The SAME scenarios, invariants and correct-behaviour assertions as the
  // known-defect specs, with only the allocator swapped for a correct one. They
  // pass, so a real allocator fix flips the known-defect tests to "no longer
  // reproduces" — nothing in the specs depends on the buggy allocation.
  it.each([
    ['asset', () => assetScenario(maxPlusOne)],
    ['risk', () => riskScenario(maxPlusOne)],
    ['treatment', () => treatmentScenario(maxPlusOne)],
  ] as const)('%s: invariants hold, nothing is overwritten, the new record is persisted unchanged', async (_name, run) => {
    const s = await (run as () => Promise<Scenario<{ id: string }>>)();
    expectScenarioInvariants(s);
    expectNoOverwrite(s);
    expect(collisionSymptom(s)).toEqual({ reusedId: null, lostRecords: [], growth: 1 });
  });
});

describe('ID allocation — mechanism and contrast', () => {
  // In defect mode (`npm run test:defects`) the bodies above also show the
  // consequence: a surviving record is replaced in place and the count drops.
  it('documents the mechanism: genId is length-based', () => {
    expect(genId('AST', { length: 99 })).toBe('AST-100');
  });

  it('contrast: createLocalRepo.nextId (standalone modules) uses the highest number, so it does not collide', () => {
    const repo = createLocalRepo<{ id: string; name: string }>({
      key: 'test.collision.v1',
      seed: [{ id: 'X-001', name: 'a' }, { id: 'X-002', name: 'b' }, { id: 'X-003', name: 'c' }],
      idPrefix: 'X',
    });
    repo.remove('X-002');
    expect(repo.nextId()).toBe('X-004');
  });
});
