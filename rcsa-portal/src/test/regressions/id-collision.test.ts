// REGRESSION — data-loss defect D1: ID collision after a delete (FIXED by
// ID-integrity stage S1, docs/ID_INTEGRITY_DESIGN.md).
//
// The Asset / Risk / Treatment create modals used to allocate ids from the
// collection LENGTH (genId), and saving is an upsert by id, so after deleting
// any record other than the last the next "new" record took the id of a live
// record and silently REPLACED it — and every relationship pointing at that id
// moved to the new record (R1/R2). genId now uses the shared safe allocator
// (src/data/ids.ts). These scenarios drive the same calls the modals make
// (genId on the current list, then repo.save*) against the real
// LocalStorageRepo + seed data.
//
// Still OPEN (pinned below as known defects, closed only by stage S5):
//   R15 — an out-of-date copy that still references a DELETED parent attaches
//   to the new record that is reissued the same id.
import { describe, expect, it } from 'vitest';
import { LocalStorageRepo } from '../../data/localStorageRepo';
import { createLocalRepo } from '../../data/createLocalRepo';
import { genId } from '../../domain/scoring';
import type { Asset, Risk, Treatment } from '../../data/models';
import { knownDefect } from '../helpers';

interface Scenario<T extends { id: string }> {
  before: T[]; // collection before the delete
  deleted: T; // the record removed
  created: T; // the record the user just created
  after: T[]; // collection after the create
}
type Pick = 'first' | 'middle' | 'last';
const pickIndex = (n: number, which: Pick) => (which === 'first' ? 0 : which === 'last' ? n - 1 : Math.floor(n / 2));

async function assetScenario(which: Pick = 'middle'): Promise<Scenario<Asset>> {
  const repo = new LocalStorageRepo();
  const before = await repo.listAssets();
  const deleted = before[pickIndex(before.length, which)];
  await repo.deleteAsset(deleted.id);
  const created: Asset = { ...before[1], id: genId('AST', await repo.listAssets()), name: 'Brand-new asset (test)' };
  await repo.saveAsset(created);
  return { before, deleted, created, after: await repo.listAssets() };
}

async function riskScenario(which: Pick = 'middle'): Promise<Scenario<Risk>> {
  const repo = new LocalStorageRepo();
  const before = await repo.listRisks();
  const deleted = before[pickIndex(before.length, which)];
  await repo.deleteRisk(deleted.id);
  const created: Risk = { ...before[1], id: genId('RSK', await repo.listRisks()), threat: 'Brand-new risk (test)' };
  await repo.saveRisk(created);
  return { before, deleted, created, after: await repo.listRisks() };
}

async function treatmentScenario(which: Pick = 'middle'): Promise<Scenario<Treatment>> {
  const repo = new LocalStorageRepo();
  const before = await repo.listTreatments();
  const deleted = before[pickIndex(before.length, which)];
  await repo.deleteTreatment(deleted.id);
  const created: Treatment = { ...before[1], id: genId('TRT', await repo.listTreatments()), title: 'Brand-new treatment (test)' };
  await repo.saveTreatment(created);
  return { before, deleted, created, after: await repo.listTreatments() };
}

const survivorsOf = <T extends { id: string }>(s: Scenario<T>) => s.before.filter((x) => x.id !== s.deleted.id);

/** Scenario facts: the delete really happened; the new record is persisted exactly once, unchanged. */
function expectScenarioInvariants<T extends { id: string }>(s: Scenario<T>): void {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  expect(s.before.length, 'fixture has records to delete from').toBeGreaterThan(2);
  expect(s.before.some((x) => x.id === s.deleted.id), 'deleted record existed').toBe(true);
  expect(s.after.some((x) => same(x, s.deleted)), 'deleted record content is gone').toBe(false);
  expect(s.after.filter((x) => x.id === s.created.id), 'new record persisted exactly once, unchanged').toEqual([s.created]);
}

/**
 * S1 guarantee: the new id belongs to NO LIVE record, every survivor is
 * unchanged, and the collection grew by exactly one. (S1 may reissue the id of
 * the deleted HIGHEST record — R5, closed only by S5; its harmful consequence
 * R15 is pinned below as a known defect.)
 */
function expectNoOverwrite<T extends { id: string }>(s: Scenario<T>): void {
  const survivors = survivorsOf(s);
  expect(survivors.map((x) => x.id)).not.toContain(s.created.id);
  for (const x of survivors) expect(s.after.find((y) => y.id === x.id)).toEqual(x);
  expect(s.after).toHaveLength(survivors.length + 1);
}

// ── Fixture facts ───────────────────────────────────────────────────────────
describe('ID collision — fixture', () => {
  it('fresh seed: 100 assets, and risk/treatment sets large enough to delete from', async () => {
    const repo = new LocalStorageRepo();
    expect(await repo.listAssets()).toHaveLength(100);
    expect((await repo.listTreatments()).length).toBeGreaterThan(2);
    expect((await repo.listRisks()).length).toBeGreaterThan(2);
  });

  it('the last seed ids are AST-100, RSK-204 and TRT-195', async () => {
    const repo = new LocalStorageRepo();
    const last = <T extends { id: string }>(xs: T[]) => xs[xs.length - 1].id;
    expect(last(await repo.listAssets())).toBe('AST-100');
    expect(last(await repo.listTreatments())).toBe('TRT-195');
    expect(last(await repo.listRisks())).toBe('RSK-204');
  });
});

// ── D1 regression (was a known defect; fixed by S1) ─────────────────────────
describe('ID collision after deleting a record (D1 regression)', () => {
  it.each(['first', 'middle', 'last'] as const)('asset: delete the %s record, then create — no live record is overwritten', async (which) => {
    const s = await assetScenario(which);
    expectScenarioInvariants(s);
    expectNoOverwrite(s);
  });
  it.each(['first', 'middle', 'last'] as const)('risk: delete the %s record, then create — no live record is overwritten', async (which) => {
    const s = await riskScenario(which);
    expectScenarioInvariants(s);
    expectNoOverwrite(s);
  });
  it.each(['first', 'middle', 'last'] as const)('treatment: delete the %s record, then create — no live record is overwritten', async (which) => {
    const s = await treatmentScenario(which);
    expectScenarioInvariants(s);
    expectNoOverwrite(s);
  });
});

// ── Relationships survive delete + create (R2 path closed by S1) ────────────
describe('relationships are not moved by a create after a delete', () => {
  it('risks keep pointing at the same asset content; treatments at the same risk content', async () => {
    const repo = new LocalStorageRepo();
    const assetsBefore = new Map((await repo.listAssets()).map((a) => [a.id, a]));
    const risksBefore = new Map((await repo.listRisks()).map((r) => [r.id, r]));

    await repo.deleteAsset('AST-001');
    await repo.deleteRisk('RSK-002');
    await repo.saveAsset({ ...assetsBefore.get('AST-050')!, id: genId('AST', await repo.listAssets()), name: 'New asset (test)' });
    await repo.saveRisk({ ...risksBefore.get('RSK-050')!, id: genId('RSK', await repo.listRisks()), threat: 'New risk (test)' });

    const assetsAfter = new Map((await repo.listAssets()).map((a) => [a.id, a]));
    const risksAfter = new Map((await repo.listRisks()).map((r) => [r.id, r]));
    for (const r of risksAfter.values()) {
      if (r.threat === 'New risk (test)') continue;
      for (const aid of r.assetIds) expect(assetsAfter.get(aid), `${r.id} → ${aid}`).toEqual(assetsBefore.get(aid));
    }
    for (const t of await repo.listTreatments()) {
      for (const rid of t.riskIds) expect(risksAfter.get(rid), `${t.id} → ${rid}`).toEqual(risksBefore.get(rid));
    }
  });
});

// ── Still open: R15, out-of-date reference retargeting (closed only by S5) ──
// Delete the HIGHEST parent; S1 allocates highest+1 over the remaining ids and
// so reissues the deleted id; an out-of-date child copy that still references
// it is then saved and silently links to the NEW, unrelated parent.
describe('R15 — out-of-date reference attaches to a reissued id (known defect until S5)', () => {
  knownDefect('an out-of-date risk referencing a deleted asset does not link to a new, unrelated asset', {
    observe: async () => {
      const repo = new LocalStorageRepo();
      const risk = (await repo.listRisks()).find((r) => r.assetIds.length === 1 && r.assetIds[0] !== 'AST-100')!;
      const linked: Risk = { ...risk, assetIds: [risk.assetIds[0], 'AST-100'] };
      await repo.saveRisk(linked);
      const staleCopy = { ...linked }; // e.g. an open edit form / another tab
      await repo.deleteAsset('AST-100');
      const newAssetId = genId('AST', await repo.listAssets());
      await repo.saveAsset({ ...(await repo.listAssets())[0], id: newAssetId, name: 'Unrelated new asset (test)' });
      await repo.saveRisk(staleCopy);
      const saved = (await repo.listRisks()).find((r) => r.id === linked.id)!;
      return { newAssetId, saved, deletedAssetGone: !(await repo.listAssets()).some((a) => a.id === 'AST-100' && a.name !== 'Unrelated new asset (test)') };
    },
    invariants: (o) => { expect(o.saved).toBeDefined(); expect(o.deletedAssetGone).toBe(true); },
    correct: (o) => expect(o.saved.assetIds).not.toContain(o.newAssetId),
    symptom: (o) => ({ newAssetId: o.newAssetId, riskLinksNewAsset: o.saved.assetIds.includes(o.newAssetId) }),
    documented: { newAssetId: 'AST-100', riskLinksNewAsset: true },
  });

  knownDefect('an out-of-date treatment referencing a deleted risk does not link to a new, unrelated risk', {
    observe: async () => {
      const repo = new LocalStorageRepo();
      const t = (await repo.listTreatments()).find((x) => x.riskIds.length === 1 && x.riskIds[0] !== 'RSK-204')!;
      const linked: Treatment = { ...t, riskIds: [t.riskIds[0], 'RSK-204'] };
      await repo.saveTreatment(linked);
      const staleCopy = { ...linked };
      await repo.deleteRisk('RSK-204');
      const newRiskId = genId('RSK', await repo.listRisks());
      await repo.saveRisk({ ...(await repo.listRisks())[0], id: newRiskId, threat: 'Unrelated new risk (test)' });
      await repo.saveTreatment(staleCopy);
      const saved = (await repo.listTreatments()).find((x) => x.id === linked.id)!;
      return { newRiskId, saved };
    },
    invariants: (o) => expect(o.saved).toBeDefined(),
    correct: (o) => expect(o.saved.riskIds).not.toContain(o.newRiskId),
    symptom: (o) => ({ newRiskId: o.newRiskId, treatmentLinksNewRisk: o.saved.riskIds.includes(o.newRiskId) }),
    documented: { newRiskId: 'RSK-204', treatmentLinksNewRisk: true },
  });
});

describe('ID allocation — contrast', () => {
  it('createLocalRepo.nextId (standalone modules) does not collide after deleting a middle record', () => {
    const repo = createLocalRepo<{ id: string; name: string }>({
      key: 'test.collision.v1',
      seed: [{ id: 'X-001', name: 'a' }, { id: 'X-002', name: 'b' }, { id: 'X-003', name: 'c' }],
      idPrefix: 'X',
    });
    repo.remove('X-002');
    expect(repo.nextId()).toBe('X-004');
  });
});
