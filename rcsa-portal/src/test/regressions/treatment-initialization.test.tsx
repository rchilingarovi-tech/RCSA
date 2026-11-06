// PROPOSED REGRESSION TEST — Treatment Catalogue initialisation (fresh browser).
//
// Defect: on an empty localStorage the AppStore loads with
//   Promise.all([repo.listAssets(), repo.listRisks(), repo.listTreatments()])
// listRisks() seeds `rcsa.risks.v1` first; listTreatments() then sees "risks
// present, treatments absent", takes the LEGACY-MIGRATION path, derives []
// from the (non-legacy) seed risks and PERSISTS [] — so the app shows zero
// treatments permanently (until "Reset demo data").
//
// Part A asserts the correct behaviour (fails today, passes after the fix).
// Part B are guards that must pass BOTH today and after the fix: they pin the
// behaviours the fix must not change (legacy migration, existing data).
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AppStoreProvider, useStore } from '../../state/AppStore';
import { LocalStorageRepo } from '../../data/localStorageRepo';
import { SEED_RISKS, SEED_TREATMENTS } from '../../data/seed';
import { riskStatus } from '../../domain/scoring';
import type { Risk, Treatment } from '../../data/models';
import { freezeLocalTime, knownDefect } from '../helpers';

const TREATMENTS_KEY = 'rcsa.treatments.v1';
const RISKS_KEY = 'rcsa.risks.v1';
const persisted = <T,>(key: string): T[] | null => {
  const raw = localStorage.getItem(key);
  return raw == null ? null : (JSON.parse(raw) as T[]);
};
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

/** Render the REAL AppStoreProvider on the current storage and return its loaded state. */
async function loadAppStore(): Promise<{ risks: Risk[]; treatments: Treatment[] }> {
  let snapshot: { risks: Risk[]; treatments: Treatment[] } | null = null;
  function Probe() {
    const store = useStore();
    useEffect(() => {
      if (store.loaded) snapshot = { risks: store.risks, treatments: store.treatments };
    }, [store.loaded, store.risks, store.treatments]);
    return null;
  }
  render(<AppStoreProvider><Probe /></AppStoreProvider>);
  await waitFor(() => expect(snapshot).not.toBeNull());
  return snapshot!;
}

// ── Part A: the defect (fails today, passes after the fix) ───────────────────
describe('Treatment initialisation on a fresh browser', () => {
  it('fixture: the seed has treatments that address seed risks', () => {
    expect(SEED_TREATMENTS.length).toBeGreaterThan(0);
    const riskIds = new Set(ids(SEED_RISKS));
    expect(SEED_TREATMENTS.every((t) => t.riskIds.every((id) => riskIds.has(id)))).toBe(true);
  });

  it('the real AppStore initialisation loads every seeded treatment, exactly', async () => {
    const { risks, treatments } = await loadAppStore();
    expect(ids(risks)).toEqual(ids(SEED_RISKS)); // init really ran
    expect(treatments).toEqual(SEED_TREATMENTS); // full records incl. riskIds — today: []
  });

  it('…and persists them exactly, so a reload still shows them', async () => {
    await loadAppStore();
    expect(persisted<Treatment>(TREATMENTS_KEY)).toEqual(SEED_TREATMENTS); // today: []
    expect(await new LocalStorageRepo().listTreatments()).toEqual(SEED_TREATMENTS);
  });

  it('risk statuses roll up from the seeded treatments (not all "No Plan")', async () => {
    freezeLocalTime(2026, 11, 6);
    const { risks, treatments } = await loadAppStore();
    const expected = SEED_RISKS.map((r) => riskStatus(r, SEED_TREATMENTS));
    expect(risks.map((r) => riskStatus(r, treatments))).toEqual(expected);
  });

  it.each([
    ['risks, then treatments', ['listRisks', 'listTreatments']],
    ['treatments, then risks', ['listTreatments', 'listRisks']],
    ['assets, risks, treatments (AppStore order)', ['listAssets', 'listRisks', 'listTreatments']],
  ] as const)('repository: seeded treatments regardless of read order (%s)', async (_label, order) => {
    const repo = new LocalStorageRepo();
    let treatments: Treatment[] = [];
    for (const m of order) {
      const out = await repo[m]();
      if (m === 'listTreatments') treatments = out as Treatment[];
    }
    expect(treatments).toEqual(SEED_TREATMENTS);
  });
});

// ── Part B: guards — must pass today AND after the fix ───────────────────────
// (Treatment fixtures for the partial-storage cases.)
const customTreatment = (): Treatment => ({
  id: 'TRT-900', riskIds: [SEED_RISKS[0].id], title: 'Custom', description: '', owner: 'Me',
  dueDate: '', status: 'Open', evidence: [], comments: [], submittedAt: '2026-01-01',
});
describe('Treatment initialisation — behaviour the fix must preserve', () => {
  it('fresh store read treatments-first is seeded (existing path)', async () => {
    expect(await new LocalStorageRepo().listTreatments()).toHaveLength(SEED_TREATMENTS.length);
  });

  it('an existing EMPTY treatment set is kept (a user may have deleted every treatment)', async () => {
    localStorage.setItem(RISKS_KEY, JSON.stringify(SEED_RISKS));
    localStorage.setItem(TREATMENTS_KEY, '[]');
    const { treatments } = await loadAppStore();
    expect(treatments).toEqual([]);
    expect(persisted(TREATMENTS_KEY)).toEqual([]);
  });

  it('existing custom treatments are kept unchanged', async () => {
    const custom = [customTreatment()];
    localStorage.setItem(RISKS_KEY, JSON.stringify(SEED_RISKS));
    localStorage.setItem(TREATMENTS_KEY, JSON.stringify(custom));
    const { treatments } = await loadAppStore();
    expect(treatments).toEqual(custom);
  });

  it.each([
    ['an empty set', [] as Treatment[]],
    ['custom treatments', [customTreatment()]],
  ])('existing treatments (%s) are kept when the RISKS key is absent; risks are seeded', async (_l, existing) => {
    localStorage.setItem(TREATMENTS_KEY, JSON.stringify(existing));
    const { risks, treatments } = await loadAppStore();
    expect(treatments).toEqual(existing);
    expect(persisted(TREATMENTS_KEY)).toEqual(existing);
    expect(ids(risks)).toEqual(ids(SEED_RISKS));
  });

  it('custom NON-legacy risks with the treatments key absent are NOT given demo treatments', async () => {
    // The scenario that makes "seed whenever risks are not legacy" unsafe.
    const own: Risk[] = [{ ...SEED_RISKS[0], id: 'RSK-500', threat: 'My own risk' }];
    localStorage.setItem(RISKS_KEY, JSON.stringify(own));
    const { risks, treatments } = await loadAppStore();
    expect(risks).toEqual(own);
    expect(treatments).toEqual([]);
    expect(persisted(TREATMENTS_KEY)).toEqual([]);
  });

  it('storage entirely unavailable: both collections fall back to the in-memory seed', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage disabled'); });
    const repo = new LocalStorageRepo();
    const risks = await repo.listRisks();
    const treatments = await repo.listTreatments();
    expect(ids(risks)).toEqual(ids(SEED_RISKS));
    expect(treatments).toEqual(SEED_TREATMENTS);
  });

  it.each([
    ['treatments read first', true],
    ['risks read first (AppStore order)', false],
  ] as const)('legacy data is still migrated once: embedded plans become treatments, risks are cleaned (%s)', async (_l, treatmentsFirst) => {
    freezeLocalTime(2026, 11, 6);
    const legacy = [
      { ...SEED_RISKS[0], id: 'RSK-001', assetIds: undefined, assetId: 'AST-001', actionPlan: 'Patch servers', responsible: 'IT Ops', deadline: '2026-12-31', treatmentStatus: 'In Progress' },
      { ...SEED_RISKS[1], id: 'RSK-002', assetIds: undefined, assetId: 'AST-002' }, // no plan → no treatment
    ];
    localStorage.setItem(RISKS_KEY, JSON.stringify(legacy));
    const repo = new LocalStorageRepo();
    if (!treatmentsFirst) await repo.listRisks();
    const treatments = await repo.listTreatments();
    expect(treatments).toEqual([{
      id: 'TRT-001', riskIds: ['RSK-001'], title: 'Patch servers', description: 'Patch servers', owner: 'IT Ops',
      dueDate: '2026-12-31', status: 'In Progress', evidence: [], comments: [], submittedAt: '2026-11-06',
    }]);
    const cleaned = persisted<Record<string, unknown>>(RISKS_KEY)!;
    expect(cleaned.map((r) => r.assetIds)).toEqual([['AST-001'], ['AST-002']]);
    for (const r of cleaned) for (const k of ['assetId', 'actionPlan', 'responsible', 'deadline', 'treatmentStatus']) expect(r).not.toHaveProperty(k);
    // Migration happens ONCE: a second read returns the same treatments and
    // does not re-derive or duplicate them.
    const again = new LocalStorageRepo();
    expect(await again.listTreatments()).toEqual(treatments);
    expect(await again.listRisks()).toHaveLength(2);
    expect(await again.listTreatments()).toEqual(treatments);
  });

  it('"Reset demo data" restores all three collections exactly', async () => {
    localStorage.setItem(TREATMENTS_KEY, '[]');
    const repo = new LocalStorageRepo();
    const reset = await repo.resetToSeed();
    expect(reset.treatments).toEqual(SEED_TREATMENTS);
    expect(await repo.listAssets()).toEqual(reset.assets);
    expect(await repo.listRisks()).toEqual(SEED_RISKS);
    expect(await repo.listTreatments()).toEqual(SEED_TREATMENTS);
  });
});

// ── Residual limitation (NOT fixed by the proposed change) ───────────────────
// Writes are swallowed (localStorageRepo.write). If ONLY the treatment seed write
// fails while the risk write succeeds, treatment loading still takes the legacy
// path and returns []. Same outcome before and after the proposed fix; robust
// handling needs atomic multi-key writes (separate persistence-hardening scope).
// Pinned as a known defect so a future change surfaces it.
describe('Treatment initialisation — residual storage-failure limitation', () => {
  knownDefect('a failed treatment-seed write on a fresh install still yields seeded treatments', {
    observe: async () => {
      const real = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
        if (k === TREATMENTS_KEY) throw new Error('quota exceeded');
        return real.call(this, k, v);
      });
      const repo = new LocalStorageRepo();
      await repo.listRisks();
      const treatments = await repo.listTreatments();
      return { treatments: treatments.length, risksPersisted: (persisted(RISKS_KEY) ?? []).length };
    },
    invariants: (o) => expect(o.risksPersisted).toBe(SEED_RISKS.length), // risk write succeeded
    correct: (o) => expect(o.treatments).toBe(SEED_TREATMENTS.length),
    symptom: (o) => o,
    documented: { treatments: 0, risksPersisted: SEED_RISKS.length },
  });
});
