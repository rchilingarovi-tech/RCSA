// Regression tests for ID-integrity stage S1 — the shared safe allocator and
// every automatic ID path that uses it (docs/ID_INTEGRITY_DESIGN.md §4–5).
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { allocateId, allocateOrReport, createIdAllocator, IdAllocationError, MAX_ID_NUMBER } from './ids';
import { LocalStorageRepo } from './localStorageRepo';
import type { LocalRepo } from './createLocalRepo';
import { importCsvText } from '../lib/tableIo';
import { parseAssetsFile, parseRisksFile, parseTreatmentsFile } from '../io/import';
import { vendorIo } from '../modules/vendors/io';
import { accessRepo } from '../modules/access/repo';
import { awarenessRepo } from '../modules/awareness/repo';
import { committeeRepo } from '../modules/committee/repo';
import { complianceRepo } from '../modules/compliance/repo';
import { findingsRepo } from '../modules/findings/repo';
import { incidentRepo } from '../modules/incidents/repo';
import { kpiRepo } from '../modules/kpis/repo';
import { planRepo } from '../modules/plan/repo';
import { policyRepo } from '../modules/policies/repo';
import { vendorRepo } from '../modules/vendors/repo';
import { vulnRepo } from '../modules/vulns/repo';
import { UiProvider } from '../components/common/UiProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { AppStoreProvider, useStore } from '../state/AppStore';
import { ModalsProvider, useModals } from '../state/ModalsProvider';
import { IncidentModal } from '../modules/incidents/IncidentModal';
import type { Asset } from './models';
import type { Vendor } from '../modules/vendors/types';
import type { Incident } from '../modules/incidents/types';
import { csvFile } from '../test/helpers';

// ── 1. The allocator ────────────────────────────────────────────────────────
describe('allocateId — rules', () => {
  it('first id in an empty collection', () => {
    expect(allocateId('AST', [], 3)).toBe('AST-001');
    expect(allocateId('VEN', [], 2)).toBe('VEN-01');
  });

  it('allocates after the highest canonical number; gaps are never refilled', () => {
    expect(allocateId('AST', ['AST-001', 'AST-002', 'AST-003'], 3)).toBe('AST-004');
    expect(allocateId('AST', ['AST-001', 'AST-003'], 3)).toBe('AST-004'); // middle deleted
    expect(allocateId('AST', ['AST-002', 'AST-003'], 3)).toBe('AST-004'); // first deleted
  });

  it('pads to the requested width but never truncates', () => {
    expect(allocateId('VEN', ['VEN-99'], 2)).toBe('VEN-100');
    expect(allocateId('INC', ['INC-009'], 3)).toBe('INC-010');
  });

  it('non-canonical ids are ignored for numbering but still count as taken', () => {
    // lowercase, other prefix, extra separator, suffix letters, no number
    const taken = ['ast-500', 'XYZ-900', 'AST-2026-01', 'AST-007b', 'AST-', 'AST'];
    expect(allocateId('AST', taken, 3)).toBe('AST-001');
  });

  it('a candidate that differs from a taken id only by letter case is skipped', () => {
    expect(allocateId('VEN', ['VEN-06', 'ven-07'], 2)).toBe('VEN-08');
    expect(allocateId('AST', ['ast-001'], 3)).toBe('AST-002');
  });

  it('VEN-2026-01 no longer makes numbering jump to 202602', () => {
    expect(allocateId('VEN', ['VEN-01', 'VEN-2026-01'], 2)).toBe('VEN-02');
  });

  it.each([
    ['VEN-9007199254740992'], // 2^53: +1 no longer advances a JS number
    ['VEN-99999999999999999999'], // 20 digits
    ['VEN-1000000000'], // 10 digits, just above the bound
  ])('an oversized id (%s) never causes reuse or a hang', (big) => {
    const id = allocateId('VEN', ['VEN-01', big], 2);
    expect(id).toBe('VEN-02');
    expect(id).not.toBe(big);
  });

  it('fails with IdAllocationError at the numbering limit instead of looping or reusing', () => {
    const at = `AST-${MAX_ID_NUMBER}`;
    expect(() => allocateId('AST', ['AST-001', at], 3)).toThrow(IdAllocationError);
    expect(() => allocateId('AST', ['AST-001', at], 3)).toThrow(/numbering limit/);
  });

  it('just below the limit still allocates', () => {
    expect(allocateId('AST', [`AST-${MAX_ID_NUMBER - 1}`], 3)).toBe(`AST-${MAX_ID_NUMBER}`);
  });

  it('never returns a taken id, across many random collections (property check)', () => {
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let run = 0; run < 300; run += 1) {
      const taken = Array.from({ length: Math.floor(rnd() * 30) }, () => {
        const kind = rnd();
        if (kind < 0.6) return `KPI-${String(Math.floor(rnd() * 60)).padStart(2, '0')}`;
        if (kind < 0.8) return `kpi-${Math.floor(rnd() * 60)}`;
        return `KPI-${Math.floor(rnd() * 1e12)}`;
      });
      const id = allocateId('KPI', taken, 2);
      expect(taken.map((t) => t.toUpperCase())).not.toContain(id.toUpperCase());
      expect(id).toMatch(/^KPI-\d{2,9}$/);
    }
  });
});

describe('createIdAllocator — incremental batch allocation', () => {
  it('allocates in sequence and honours reserved ids (case-insensitively)', () => {
    const a = createIdAllocator('VEN', ['VEN-01'], 2);
    expect(a.next()).toBe('VEN-02');
    a.reserve('VEN-10');
    expect(a.next()).toBe('VEN-11');
    a.reserve('ven-12');
    expect(a.next()).toBe('VEN-13');
  });

  it('gives the same results as allocateId called afresh each time', () => {
    const taken = ['KPI-03', 'kpi-05', 'KPI-2026-01', 'KPI-9007199254740992'];
    const a = createIdAllocator('KPI', taken, 2);
    const fresh = [...taken];
    for (let i = 0; i < 20; i += 1) {
      const expected = allocateId('KPI', fresh, 2);
      expect(a.next()).toBe(expected);
      fresh.push(expected);
    }
  });

  it('throws at the limit instead of looping', () => {
    const a = createIdAllocator('AST', [`AST-${MAX_ID_NUMBER - 1}`], 3);
    expect(a.next()).toBe(`AST-${MAX_ID_NUMBER}`);
    expect(() => a.next()).toThrow(IdAllocationError);
  });
});

describe('allocateOrReport', () => {
  it('returns the id, or reports a readable message and returns null', () => {
    const report = vi.fn();
    expect(allocateOrReport(() => 'X-01', report)).toBe('X-01');
    expect(report).not.toHaveBeenCalled();
    expect(allocateOrReport(() => { throw new IdAllocationError('limit reached'); }, report)).toBeNull();
    expect(report).toHaveBeenCalledWith('limit reached');
  });
});

// ── 2. Same allocation as before for every module's seed (backward compat) ──
// Pre-S1 rules: RCSA genId = length + 1; createLocalRepo = strip non-digits,
// max + 1. On the shipped seeds both equal "highest canonical + 1".
const legacyStripMax = (ids: string[], prefix: string, pad: number) =>
  `${prefix}-${String(ids.reduce((m, id) => Math.max(m, Number(id.replace(/\D/g, '')) || 0), 0) + 1).padStart(pad, '0')}`;

const MODULE_REPOS: [string, LocalRepo<{ id: string }>, string, number][] = [
  ['Access Reviews', accessRepo, 'ACR', 2], ['Awareness', awarenessRepo, 'TRN', 2], ['Committee', committeeRepo, 'MTG', 2],
  ['Compliance', complianceRepo, 'CTL', 3], ['Findings', findingsRepo, 'FND', 2], ['Incidents', incidentRepo, 'INC', 3],
  ['KPIs', kpiRepo, 'KPI', 2], ['Yearly Plan', planRepo, 'INI', 2], ['Policies', policyRepo, 'POL', 2],
  ['Vendors', vendorRepo, 'VEN', 2], ['Vulnerabilities', vulnRepo, 'VUL', 2],
];

describe('backward compatibility — the same next id as before on every seed', () => {
  it('RCSA: Assets, Risks, Treatments (old rule: length + 1)', async () => {
    const repo = new LocalStorageRepo();
    for (const [prefix, list] of [['AST', await repo.listAssets()], ['RSK', await repo.listRisks()], ['TRT', await repo.listTreatments()]] as const) {
      expect(allocateId(prefix, list.map((x) => x.id), 3)).toBe(`${prefix}-${String(list.length + 1).padStart(3, '0')}`);
    }
  });

  it.each(MODULE_REPOS)('%s (old rule: strip non-digits, max + 1)', (_name, repo, prefix, pad) => {
    const ids = repo.list().map((x) => x.id);
    expect(repo.nextId()).toBe(legacyStripMax(ids, prefix, pad));
  });
});

// ── 3. All 11 createLocalRepo modules: delete + create never overwrites ─────
describe('createLocalRepo modules — delete then create never overwrites a live record', () => {
  it.each(MODULE_REPOS.flatMap(([name, repo]) => (['first', 'middle', 'last'] as const).map((w) => [name, repo, w] as const)))(
    '%s: delete the %s record, create, nothing overwritten',
    (_name, repo, which) => {
      const before = repo.list();
      const victim = before[which === 'first' ? 0 : which === 'last' ? before.length - 1 : Math.floor(before.length / 2)];
      repo.remove(victim.id);
      const survivors = repo.list();
      const id = repo.nextId();
      expect(survivors.map((x) => x.id)).not.toContain(id);
      const created = { ...survivors[0], id };
      const after = repo.save(created);
      for (const s of survivors) expect(after.find((x) => x.id === s.id)).toEqual(s);
      expect(after.filter((x) => x.id === id)).toEqual([created]);
      expect(after).toHaveLength(survivors.length + 1);
    },
  );
});

describe('createLocalRepo — oversized, malformed and limit ids', () => {
  const vendor = (id: string, name = `Vendor ${id}`): Vendor => ({ ...vendorRepo.list()[0], id, name });

  it('with VEN-9007199254740992 stored, the next id is fresh and saving it overwrites nothing (was: reused → overwrite)', () => {
    vendorRepo.save(vendor('VEN-9007199254740992', 'Huge'));
    const id = vendorRepo.nextId();
    expect(id).not.toBe('VEN-9007199254740992');
    const after = vendorRepo.save(vendor(id, 'New'));
    expect(after.find((v) => v.id === 'VEN-9007199254740992')?.name).toBe('Huge');
  });

  it('lowercase / malformed stored ids are preserved and never collided with', () => {
    vendorRepo.save(vendor('ven-07', 'lower'));
    vendorRepo.save(vendor('VEN-2026-01', 'dated'));
    const id = vendorRepo.nextId();
    expect(['VEN-07', 'VEN-2026-01']).not.toContain(id);
    expect(id.toUpperCase()).not.toBe('VEN-07');
    const ids = vendorRepo.list().map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['ven-07', 'VEN-2026-01']));
  });

  it('at the numbering limit nextId throws IdAllocationError and nothing is written', () => {
    vendorRepo.save(vendor(`VEN-${MAX_ID_NUMBER}`, 'At limit'));
    const before = JSON.stringify(vendorRepo.list());
    expect(() => vendorRepo.nextId()).toThrow(IdAllocationError);
    expect(JSON.stringify(vendorRepo.list())).toBe(before);
  });
});

// ── 4. Importers ────────────────────────────────────────────────────────────
describe('CSV importers use the shared allocator', () => {
  const v = (id: string): Vendor => ({ ...vendorRepo.list()[0], id, name: `V ${id}` });

  it('standalone importer: an oversized existing id no longer hangs; blank rows get fresh ids', () => {
    const r = importCsvText(vendorIo, 'ID,Name\n,A\n,B\n', [v('VEN-01'), v('VEN-9007199254740992')]);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.id)).toEqual(['VEN-02', 'VEN-03']);
  });

  it('standalone importer: at the limit a blank-id row becomes a row error; other rows still import', () => {
    const r = importCsvText(vendorIo, 'ID,Name\n,Needs id\nVEN-05,Explicit\n', [v(`VEN-${MAX_ID_NUMBER}`)]);
    expect(r.rows.map((x) => x.id)).toEqual(['VEN-05']);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 2, field: 'ID', message: expect.stringMatching(/numbering limit/) }]);
  });

  it('RCSA importer: blank ids skip ids already taken case-insensitively', async () => {
    const existing = (await new LocalStorageRepo().listAssets()).slice(0, 1).map((a) => ({ ...a, id: 'ast-001' }));
    const r = await parseAssetsFile(csvFile('Name\nA\n'), existing);
    expect(r.rows[0].id).toBe('AST-002');
  });

  // Codex S1 review finding 1: a REJECTED row must not reserve its explicit id
  // or advance numbering for later valid rows (develop imported AST-001 here).
  it('RCSA assets: a rejected row with an id at the limit does not exhaust numbering for a valid row', async () => {
    const r = await parseAssetsFile(csvFile(`Asset ID,Name\nAST-${MAX_ID_NUMBER},\n,Valid asset\n`), []);
    expect(r.rows.map((x) => [x.id, x.name])).toEqual([['AST-001', 'Valid asset']]);
    expect(r.errors).toEqual([{ row: 2, field: 'Name', message: 'Name is required' }]);
  });

  it('RCSA risks: a rejected row with an id at the limit does not exhaust numbering for a valid row', async () => {
    const assets = (await new LocalStorageRepo().listAssets()).slice(0, 1);
    const r = await parseRisksFile(csvFile(`Risk ID,Asset ID,Threat\nRSK-${MAX_ID_NUMBER},${assets[0].id},\n,${assets[0].id},DDoS\n`), [], assets);
    expect(r.rows.map((x) => x.id)).toEqual(['RSK-001']);
    expect(r.errors).toEqual([{ row: 2, field: 'Threat', message: 'Threat is required' }]);
  });

  it('RCSA treatments: a rejected row with an id at the limit does not exhaust numbering for a valid row', async () => {
    const risks = (await new LocalStorageRepo().listRisks()).slice(0, 1);
    const r = await parseTreatmentsFile(csvFile(`Treatment ID,Title,Risk ID\nTRT-${MAX_ID_NUMBER},,${risks[0].id}\n,Valid,${risks[0].id}\n`), [], risks);
    expect(r.rows.map((x) => x.id)).toEqual(['TRT-001']);
    expect(r.errors).toEqual([{ row: 2, field: 'Title', message: 'Title is required' }]);
  });

  it('a rejected row no longer blocks a later valid row from using the same explicit id', async () => {
    const r = await parseAssetsFile(csvFile('Asset ID,Name\nAST-777,\nAST-777,Valid\n'), []);
    expect(r.rows.map((x) => x.id)).toEqual(['AST-777']);
  });

  // Codex S1 review finding 2: batch allocation must stay linear (a quadratic
  // version took ~8 s for 10,000 rows; develop ~12 ms). Generous budget.
  it('bulk import of 10,000 blank-id rows stays fast (standalone importer)', () => {
    const csv = 'ID,Name\n' + Array.from({ length: 10_000 }, (_, i) => `,Vendor ${i}`).join('\n');
    const t0 = performance.now();
    const r = importCsvText(vendorIo, csv, []);
    const ms = performance.now() - t0;
    expect(r.rows).toHaveLength(10_000);
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(10_000);
    expect(ms).toBeLessThan(2_000);
  });

  it('bulk import of 10,000 blank-id rows stays fast (RCSA importer)', async () => {
    const csv = 'Name\n' + Array.from({ length: 10_000 }, (_, i) => `Asset ${i}`).join('\n');
    const t0 = performance.now();
    const r = await parseAssetsFile(csvFile(csv), []);
    const ms = performance.now() - t0;
    expect(r.rows).toHaveLength(10_000);
    expect(new Set(r.rows.map((x) => x.id)).size).toBe(10_000);
    expect(ms).toBeLessThan(4_000);
  });

  it('RCSA importer: at the limit a blank-id row becomes a row error', async () => {
    const base = (await new LocalStorageRepo().listAssets())[0];
    const r = await parseAssetsFile(csvFile('Name\nA\n'), [{ ...base, id: `AST-${MAX_ID_NUMBER}` }]);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ row: 2, field: 'Asset ID', message: expect.stringMatching(/numbering limit/) }]);
  });
});

// ── 4b. Legacy treatment migration (Codex S1 confirmation finding) ──────────
describe('legacy treatment migration uses the allocator linearly, with unchanged output', () => {
  it('10,000 legacy plans migrate quickly to TRT-001 … in order, content as before', async () => {
    const base = (await new LocalStorageRepo().listRisks())[0];
    localStorage.clear(); // fresh: legacy risks present, no treatments key
    const legacy = Array.from({ length: 10_000 }, (_, i) => ({
      ...base, id: `RSK-${i + 1}`, assetIds: undefined, assetId: base.assetIds[0],
      actionPlan: `Plan ${i + 1}`, responsible: 'Owner', deadline: '2027-01-01', treatmentStatus: 'In Progress',
    }));
    localStorage.setItem('rcsa.risks.v1', JSON.stringify(legacy));

    const t0 = performance.now();
    const treatments = await new LocalStorageRepo().listTreatments();
    const ms = performance.now() - t0;

    expect(treatments).toHaveLength(10_000);
    // Pre-S1 rule was a running counter `TRT-${String(n).padStart(3, '0')}` — identical ids.
    expect(treatments.map((t) => t.id)).toEqual(legacy.map((_, i) => `TRT-${String(i + 1).padStart(3, '0')}`));
    expect(treatments[9_999]).toMatchObject({ riskIds: ['RSK-10000'], title: 'Plan 10000', owner: 'Owner', dueDate: '2027-01-01', status: 'In Progress' });
    expect(ms).toBeLessThan(3_000); // quadratic version: ~7 s; develop: ~9 ms
  });
});

// ── 5. Create forms: allocation failure is shown, nothing is saved ──────────
function OpenNewAsset() {
  const store = useStore();
  const modals = useModals();
  const opened = useRef(false);
  useEffect(() => {
    if (store.loaded && !opened.current) { opened.current = true; modals.newAsset(); }
  }, [store.loaded, modals]);
  return null;
}

describe('create forms handle allocation failure', () => {
  it('RCSA (Asset): shows the reason, keeps the entered values, saves nothing', async () => {
    localStorage.setItem('infosec.auth.session', 'u-admin');
    const repo = new LocalStorageRepo();
    const assets = await repo.listAssets();
    await repo.saveAsset({ ...assets[0], id: `AST-${MAX_ID_NUMBER}` } as Asset);
    const before = localStorage.getItem('rcsa.assets.v1');

    render(<UiProvider><AuthProvider><AppStoreProvider><ModalsProvider><OpenNewAsset /></ModalsProvider></AppStoreProvider></AuthProvider></UiProvider>);
    await screen.findByText('Register New Asset');
    for (const [ph, val] of [['Asset Name *', 'Should not be saved'], ['Business Process *', 'p'], ['Department *', 'IT'], ['Business Owner *', 'b'], ['IT Owner *', 'i'], ['Applicant Name *', 'a']]) {
      fireEvent.change(screen.getByPlaceholderText(ph), { target: { value: val } });
    }
    fireEvent.submit(screen.getByPlaceholderText('Asset Name *').closest('form')!);

    expect(await screen.findByText(/Cannot allocate a new AST ID/)).toBeTruthy();
    expect(localStorage.getItem('rcsa.assets.v1')).toBe(before); // nothing saved
    expect(screen.getByText('Register New Asset')).toBeTruthy(); // form still open
    expect((screen.getByPlaceholderText('Asset Name *') as HTMLInputElement).value).toBe('Should not be saved');
  });

  it('standalone (Incident): shows the reason, keeps the entered values, does not call onSave', async () => {
    incidentRepo.save({ ...incidentRepo.list()[0], id: `INC-${MAX_ID_NUMBER}` } as Incident);
    const onSave = vi.fn();
    render(<UiProvider><IncidentModal incident="new" onClose={() => {}} onSave={onSave} /></UiProvider>);
    fireEvent.change(screen.getByLabelText('Short description *'), { target: { value: 'Kept text' } });
    fireEvent.change(screen.getByLabelText('Reported by *'), { target: { value: 'Analyst' } });
    fireEvent.submit(screen.getByLabelText('Short description *').closest('form')!);

    expect(await screen.findByText(/Cannot allocate a new INC ID/)).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Short description *') as HTMLInputElement).value).toBe('Kept text');
  });
});
