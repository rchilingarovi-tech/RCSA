/// <reference types="vite/client" />
// ID integrity S2 — import UI regression tests (design §9.1 T-UI, T-R).
// Step 1: a file with ANY error cannot be imported (Import disabled, no write),
// file errors are shown, stale selections are never imported.
// Step 4 (end of file): both UIs commit ONLY through the create-only repository
// path, show the preview table and all five outcomes, refresh from storage
// read-backs, and no old import path remains reachable.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UiProvider } from '../../components/common/UiProvider';
import { ImportExport } from '../../components/common/ImportExport';
import { ImportModal } from '../../components/ImportModal';
import { AppStoreProvider, useStore } from '../../state/AppStore';
import { vendorIo } from '../../modules/vendors/io';
import { vendorRepo } from '../../modules/vendors/repo';
import type { Vendor } from '../../modules/vendors/types';
import type { Asset, Risk } from '../../data/models';
import { csvFile } from '../helpers';

const snapshot = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
/** Spy on every localStorage write from now on (restored after each test). */
const watchWrites = () => vi.spyOn(Storage.prototype, 'setItem');
/** Module-repository stand-in: `importNew` is the given mock (returns COMMITTED with the rows). */
function importRepo(importNew = vi.fn()) {
  importNew.mockImplementation((rows: { id: string }[]) => ({ kind: 'committed', count: rows.length, records: rows }));
  return { importNew, readForImport: vi.fn() };
}
afterEach(() => { vi.restoreAllMocks(); });

function chooseFile(container: HTMLElement, text: string) {
  const input = (container.querySelector('input[type="file"]') ?? document.querySelector('input[type="file"]')) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [csvFile(text)] } });
}

describe('Standalone ImportExport: any error blocks the import', () => {
  it('a valid row next to an explicit-ID row: Import is disabled and the repository import is never called', async () => {
    const onImported = vi.fn();
    const { container } = render(
      <UiProvider>
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} repo={importRepo(onImported)} onRefreshed={() => {}} />
      </UiProvider>,
    );
    chooseFile(container, 'ID,Name\n,Acme\nVEN-05,Beta\n');
    const button = await screen.findByRole('button', { name: /^Import 1 row/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/nothing is imported until they are fixed/)).toBeTruthy();
    fireEvent.click(button);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('a malformed file shows its file error instead of "No data rows found"', async () => {
    const { container } = render(
      <UiProvider>
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} repo={importRepo()} onRefreshed={() => {}} />
      </UiProvider>,
    );
    chooseFile(container, 'Name\nAST-"001"\n');
    expect(await screen.findByText(/a quote character inside an unquoted value/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /^Import 0 rows/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('RCSA ImportModal: any error blocks the import, with zero storage writes', () => {
  function Loaded({ onReady }: { onReady: () => void }) {
    const store = useStore();
    if (store.loaded) onReady();
    return null;
  }

  async function renderModal() {
    let ready = false;
    const view = render(
      <UiProvider>
        <AppStoreProvider>
          <Loaded onReady={() => { ready = true; }} />
          <ImportModal onClose={() => {}} />
        </AppStoreProvider>
      </UiProvider>,
    );
    await waitFor(() => expect(ready).toBe(true));
    return view;
  }

  it('a valid asset row next to an explicit-ID row: Import is disabled; clicking writes nothing', async () => {
    const { container } = await renderModal();
    const before = snapshot();
    const setItem = watchWrites();
    chooseFile(container, 'Asset ID,Name\n,New asset\nAST-001,Renamed\n');
    const button = await screen.findByRole('button', { name: /^Import 1 assets/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Nothing is imported while the file has any error/)).toBeTruthy();
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 0));
    expect(snapshot()).toEqual(before);
    expect(setItem, "no localStorage write call").not.toHaveBeenCalled();
  });
});

// ── Stale-preview race (Codex Step 1 review) ─────────────────────────────────
// A file whose read is controlled by the test: resolve / reject on demand, so
// reads can complete OUT OF ORDER. Only the latest selection may ever be
// previewed or imported; a pending, failed or cleared selection imports nothing.
function deferredFile(text: string, name: string) {
  let resolveRead!: (t: string) => void;
  let rejectRead!: (e: Error) => void;
  const pending = new Promise<string>((res, rej) => { resolveRead = res; rejectRead = rej; });
  const file = csvFile(text, name);
  Object.defineProperty(file, 'text', { value: () => pending });
  return {
    file,
    resolve: async () => { await act(async () => { resolveRead(text); await pending; }); },
    reject: async () => { await act(async () => { rejectRead(new Error('read failed')); await pending.catch(() => {}); }); },
  };
}

function select(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const VALID_VENDOR = 'Name\nAcme\n';
const INVALID_VENDOR = 'ID,Name\n,Ok\nVEN-05,Explicit\n'; // 1 valid row + 1 error

describe('Standalone ImportExport: stale previews can never be imported', () => {
  function renderImportExport() {
    const onImported = vi.fn();
    render(
      <UiProvider>
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} repo={importRepo(onImported)} onRefreshed={() => {}} />
      </UiProvider>,
    );
    return onImported;
  }
  const importButton = () => screen.queryByRole('button', { name: /^Import \d+ rows?/ }) as HTMLButtonElement | null;

  it('out of order: valid A resolves AFTER malformed B; B error stays and A is never importable', async () => {
    const onImported = renderImportExport();
    const a = deferredFile(VALID_VENDOR, 'a.csv');
    const b = deferredFile('Name\nAST-"001"\n', 'b.csv');
    select([a.file]);
    select([b.file]);
    await b.resolve();
    expect(await screen.findByText(/a quote character inside an unquoted value/)).toBeTruthy();
    await a.resolve();
    expect(screen.getByText(/a quote character inside an unquoted value/)).toBeTruthy();
    expect(importButton()!.disabled).toBe(true);
    fireEvent.click(importButton()!);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('replacement: an open valid preview is withdrawn the moment a new file is chosen', async () => {
    const onImported = renderImportExport();
    const a = deferredFile(VALID_VENDOR, 'a.csv');
    select([a.file]);
    await a.resolve();
    expect(importButton()!.disabled).toBe(false);
    const b = deferredFile(INVALID_VENDOR, 'b.csv');
    select([b.file]);
    expect(importButton()).toBeNull(); // nothing importable while B is being read
    await b.resolve();
    expect(importButton()!.disabled).toBe(true); // B has an error
    fireEvent.click(importButton()!);
    expect(onImported).not.toHaveBeenCalled();
  });

  it('a failed read and a cleared selection both leave nothing importable', async () => {
    const onImported = renderImportExport();
    const a = deferredFile(VALID_VENDOR, 'a.csv');
    select([a.file]);
    await a.resolve();
    const bad = deferredFile(VALID_VENDOR, 'bad.csv');
    select([bad.file]);
    await bad.reject();
    expect(importButton()).toBeNull();
    expect(await screen.findByText(/Could not read that file/)).toBeTruthy();

    const c = deferredFile(VALID_VENDOR, 'c.csv');
    select([c.file]);
    await c.resolve();
    expect(importButton()!.disabled).toBe(false);
    select([]); // selection cleared
    expect(importButton()).toBeNull();
    expect(onImported).not.toHaveBeenCalled();
  });

  it('control: the latest valid selection is importable exactly once', async () => {
    const onImported = renderImportExport();
    const a = deferredFile(VALID_VENDOR, 'a.csv');
    select([a.file]);
    await a.resolve();
    fireEvent.click(importButton()!);
    expect(onImported).toHaveBeenCalledTimes(1);
    expect(onImported.mock.calls[0][0].map((v: { name: string }) => v.name)).toEqual(['Acme']);
  });
});

describe('RCSA ImportModal: stale previews can never be imported (zero storage writes)', () => {
  function Loaded({ onReady }: { onReady: () => void }) {
    const store = useStore();
    if (store.loaded) onReady();
    return null;
  }
  async function renderLoadedModal() {
    let ready = false;
    render(
      <UiProvider>
        <AppStoreProvider>
          <Loaded onReady={() => { ready = true; }} />
          <ImportModal onClose={() => {}} />
        </AppStoreProvider>
      </UiProvider>,
    );
    await waitFor(() => expect(ready).toBe(true));
  }
  const importButton = () => screen.getByRole('button', { name: /^(Import( \d+ assets)?|Importing…)$/ }) as HTMLButtonElement;
  const VALID_ASSET = 'Name\nNew asset\n';
  const INVALID_ASSET = 'Asset ID,Name\n,Fine\nAST-001,Renamed\n'; // 1 valid row + 1 error

  it('out of order: valid A resolves AFTER invalid B; B stays shown, Import disabled, nothing written', async () => {
    await renderLoadedModal();
    const before = snapshot();
    const setItem = watchWrites();
    const a = deferredFile(VALID_ASSET, 'a.csv');
    const b = deferredFile(INVALID_ASSET, 'b.csv');
    select([a.file]);
    select([b.file]);
    expect(importButton().disabled).toBe(true); // still reading
    await b.resolve();
    await a.resolve();
    expect(screen.getByText('b.csv')).toBeTruthy();
    expect(screen.getByText(/Nothing is imported while the file has any error/)).toBeTruthy();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    await flush();
    expect(snapshot()).toEqual(before);
    expect(setItem, "no localStorage write call").not.toHaveBeenCalled();
  });

  it('replacement: a valid preview cannot be imported while a newer file is still being read', async () => {
    await renderLoadedModal();
    const before = snapshot();
    const setItem = watchWrites();
    const a = deferredFile(VALID_ASSET, 'a.csv');
    select([a.file]);
    await a.resolve();
    expect(importButton().disabled).toBe(false);
    const b = deferredFile(INVALID_ASSET, 'b.csv');
    select([b.file]);
    expect(importButton().disabled).toBe(true); // A's preview withdrawn immediately
    fireEvent.click(importButton());
    await b.resolve();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    await flush();
    expect(snapshot()).toEqual(before);
    expect(setItem, "no localStorage write call").not.toHaveBeenCalled();
  });

  it('a failed read and a cleared selection both leave nothing importable and write nothing', async () => {
    await renderLoadedModal();
    const before = snapshot();
    const setItem = watchWrites();
    const a = deferredFile(VALID_ASSET, 'a.csv');
    select([a.file]);
    await a.resolve();
    const bad = deferredFile(VALID_ASSET, 'bad.csv');
    select([bad.file]);
    await bad.reject();
    expect(await screen.findByText(/Could not read file/)).toBeTruthy();
    expect(importButton().disabled).toBe(true);

    const c = deferredFile(VALID_ASSET, 'c.csv');
    select([c.file]);
    await c.resolve();
    expect(importButton().disabled).toBe(false);
    select([]); // selection cleared
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    await flush();
    expect(snapshot()).toEqual(before);
    expect(setItem, "no localStorage write call").not.toHaveBeenCalled();
  });

  it('control: the latest valid selection imports its own rows, and only those', async () => {
    await renderLoadedModal();
    const a = deferredFile('Name\nStale asset\n', 'a.csv');
    const b = deferredFile('Name\nFresh asset\n', 'b.csv');
    select([a.file]);
    select([b.file]);
    await b.resolve();
    await a.resolve(); // late, stale
    expect(importButton().disabled).toBe(false);
    const setItem = watchWrites();
    fireEvent.click(importButton());
    await waitFor(() => expect(localStorage.getItem('rcsa.assets.v1')).toContain('Fresh asset'));
    expect(localStorage.getItem('rcsa.assets.v1')).not.toContain('Stale asset');
    // Proves the write spy used by the rejection tests really observes storage writes.
    expect(setItem.mock.calls.some(([key]) => key === 'rcsa.assets.v1')).toBe(true);
  });
});

// ── Pending read + tab switch / close (Codex coverage note) ──────────────────
// Real components: the store, the modal and (for close) a parent that unmounts
// the modal exactly as ModalsProvider does (`importOpen && <ImportModal …/>`).
describe('RCSA ImportModal: a pending read is discarded on tab switch and on close', () => {
  const VALID_ASSET = 'Name\nPending asset\n';
  const tabButton = (name: string) => screen.getByRole('button', { name });
  const importButton = () => screen.getByRole('button', { name: /^(Import( \d+ (assets|risks|treatments))?|Importing…)$/ }) as HTMLButtonElement;

  function Loaded({ onReady }: { onReady: () => void }) {
    const store = useStore();
    if (store.loaded) onReady();
    return null;
  }

  /** Parent that opens the modal and unmounts it on close, like ModalsProvider. */
  function Host() {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Reopen import</button>
        {open && <ImportModal onClose={() => setOpen(false)} />}
      </>
    );
  }

  async function renderHost() {
    let ready = false;
    render(
      <UiProvider>
        <AppStoreProvider>
          <Loaded onReady={() => { ready = true; }} />
          <Host />
        </AppStoreProvider>
      </UiProvider>,
    );
    await waitFor(() => expect(ready).toBe(true));
  }

  it('switching tabs while a valid file is still being read: the late result never appears or imports', async () => {
    await renderHost();
    const before = snapshot();
    const setItem = watchWrites();
    const a = deferredFile(VALID_ASSET, 'a.csv');
    select([a.file]);
    expect(importButton().disabled).toBe(true); // reading
    fireEvent.click(tabButton('Risks'));
    await a.resolve(); // late result for the Assets tab
    expect(screen.queryByText('a.csv')).toBeNull();
    expect(screen.queryByText(/rows read/)).toBeNull();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    fireEvent.click(tabButton('Assets')); // back: still nothing from the stale read
    expect(screen.queryByText(/rows read/)).toBeNull();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    await flush();
    expect(setItem, 'no localStorage write call').not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it('closing the modal while a valid file is still being read: nothing is imported, and a reopened modal is empty', async () => {
    await renderHost();
    const before = snapshot();
    const setItem = watchWrites();
    const a = deferredFile(VALID_ASSET, 'a.csv');
    select([a.file]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); // closes (unmounts) the modal
    expect(screen.queryByText('Import from CSV')).toBeNull();
    await a.resolve(); // late result for an unmounted modal
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen import' }));
    expect(screen.queryByText('a.csv')).toBeNull();
    expect(screen.queryByText(/rows read/)).toBeNull();
    expect(importButton().disabled).toBe(true);
    fireEvent.click(importButton());
    await flush();
    expect(setItem, 'no localStorage write call').not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// S2 STEP 4 — UI integration: preview, outcomes, refresh, no old path
// ═════════════════════════════════════════════════════════════════════════════
const ASSETS_KEY = 'rcsa.assets.v1';
const RISKS_KEY = 'rcsa.risks.v1';
const TREATMENTS_KEY = 'rcsa.treatments.v1';
const AUDIT_KEY = 'infosec.audit.v1';
const VENDORS_KEY = 'infosec.vendors.v2';
const realSetItem = Storage.prototype.setItem;

type StoreView = ReturnType<typeof useStore>;

/** Real UiProvider + AppStoreProvider + ImportModal; exposes the live store and the onClose spy. */
async function mountImportModal() {
  let store: StoreView | null = null;
  function Probe() { store = useStore(); return null; }
  const onClose = vi.fn();
  render(
    <UiProvider>
      <AppStoreProvider>
        <Probe />
        <ImportModal onClose={onClose} />
      </AppStoreProvider>
    </UiProvider>,
  );
  await waitFor(() => expect(store?.loaded).toBe(true));
  return { store: () => store!, onClose };
}

const modalImportButton = () => screen.getByRole('button', { name: /^(Import( \d+ (assets|risks|treatments))?|Importing…)$/ }) as HTMLButtonElement;
async function chooseAndWait(text: string, name = 'f.csv') {
  const f = deferredFile(text, name);
  select([f.file]);
  await f.resolve();
}

describe('Step 4 · ImportModal: preview table (§3.6, D5-3)', () => {
  it('risks: assigned IDs, record and parent links with names; totals and validation summary', async () => {
    const { store } = await mountImportModal();
    const parent: Asset = store().assets[0];
    const nextRisk = `RSK-${String(Math.max(...store().risks.map((r) => Number(r.id.slice(4)))) + 1).padStart(3, '0')}`;
    fireEvent.click(screen.getByRole('button', { name: 'Risks' }));
    await chooseAndWait(`Asset ID,Threat\n${parent.id},DDoS\n`);
    expect(screen.getByText('1 rows read')).toBeTruthy();
    expect(screen.getByText('1 new (valid)')).toBeTruthy();
    expect(screen.getByText(nextRisk)).toBeTruthy();
    expect(screen.getByText(`${parent.id} — ${parent.name}`)).toBeTruthy();
    expect(screen.getByText(/These IDs are final/)).toBeTruthy();
    expect(modalImportButton().disabled).toBe(false);
  });

  it('lists the first 100 records, then "…and N more"; the total is always shown', async () => {
    await mountImportModal();
    await chooseAndWait('Name\n' + Array.from({ length: 105 }, (_, i) => `Bulk ${i}`).join('\n') + '\n');
    expect(screen.getByText('105 rows read')).toBeTruthy();
    expect(screen.getByText('Bulk 99')).toBeTruthy();
    expect(screen.queryByText('Bulk 100')).toBeNull();
    expect(screen.getByText('…and 5 more')).toBeTruthy();
  });
});

describe('Step 4 · ImportModal: the five outcomes through the real store and repository', () => {
  it('COMMITTED: data + audit written, store refreshed from storage, success toast, modal closes', async () => {
    const { store, onClose } = await mountImportModal();
    await chooseAndWait('Name\nImported asset\n');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    fireEvent.click(modalImportButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Imported 1 new assets.')).toBeTruthy();
    expect(setItem.mock.calls.map(([k]) => k)).toEqual([ASSETS_KEY, AUDIT_KEY]);
    expect(store().assets).toEqual(JSON.parse(localStorage.getItem(ASSETS_KEY)!));
    expect(JSON.parse(localStorage.getItem(AUDIT_KEY)!)[0].summary).toMatch(/^Created Asset AST-\d+ — Imported asset$/);
  });

  it('REJECTED (audit pre-flight): reasons shown, modal stays open, Import disabled, nothing written', async () => {
    const { onClose } = await mountImportModal();
    localStorage.setItem(AUDIT_KEY, '{}');
    await chooseAndWait('Name\nNot imported\n');
    const before = snapshot();
    const setItem = watchWrites();
    fireEvent.click(modalImportButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('The audit log is unreadable, so this import could not be recorded. Nothing was imported.');
    expect(onClose).not.toHaveBeenCalled();
    expect(modalImportButton().disabled).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it('COMMITTED, AUDIT NOT RECORDED: never shown as plain success; data kept, warning toast', async () => {
    const { onClose } = await mountImportModal();
    await chooseAndWait('Name\nNo audit\n');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === AUDIT_KEY) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, k, v);
    });
    fireEvent.click(modalImportButton());
    expect(await screen.findByText('1 new assets were imported, but the audit log could not be updated. No audit events were recorded for this import.')).toBeTruthy();
    expect(screen.queryByText('Imported 1 new assets.')).toBeNull();
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem(ASSETS_KEY)).toContain('No audit');
  });

  it('COMMITTED, AUDIT UNCERTAIN: the warning says the audit may not have been updated', async () => {
    await mountImportModal();
    await chooseAndWait('Name\nMaybe audited\n');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      realSetItem.call(this, k, v);
      if (k === AUDIT_KEY) throw new Error('late');
    });
    fireEvent.click(modalImportButton());
    expect(await screen.findByText('1 new assets were imported. The audit log may not have been updated; check the Audit Log.')).toBeTruthy();
  });

  it('UNCERTAIN with an unreadable read-back: message shown, store kept, Import disabled, no retry', async () => {
    const { store, onClose } = await mountImportModal();
    const before = store().assets;
    await chooseAndWait('Name\nUncertain\n');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === ASSETS_KEY) { realSetItem.call(this, k, '[null]'); throw new Error('late'); }
      realSetItem.call(this, k, v);
    });
    fireEvent.click(modalImportButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('The import may or may not have been saved, and the stored data could not be read back. Reloading the app would replace missing data with demo data.');
    expect(store().assets).toBe(before);
    expect(onClose).not.toHaveBeenCalled();
    expect(modalImportButton().disabled).toBe(true);
    expect(setItem.mock.calls.map(([k]) => k)).toEqual([ASSETS_KEY]);
  });

  it('UNCERTAIN with a readable read-back: the list shows what is stored', async () => {
    const { store } = await mountImportModal();
    await chooseAndWait('Name\nMaybe saved\n');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      realSetItem.call(this, k, v);
      if (k === ASSETS_KEY) throw new Error('late');
    });
    fireEvent.click(modalImportButton());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('The import may or may not have been saved. The list now shows what is stored; check it before importing again.');
    expect(store().assets).toEqual(JSON.parse(localStorage.getItem(ASSETS_KEY)!));
  });

  it('existing records and legacy risk fields stay byte-identical through the UI import', async () => {
    const legacy = '[{"id":"RSK-001","assetId":"AST-001","actionPlan":"Keep me","threat":"DDoS","assessment":"Mitigate","impact":3,"likelihood":3,"controls":[],"evidence":[],"comments":[]}]';
    localStorage.setItem(RISKS_KEY, legacy);
    localStorage.setItem(TREATMENTS_KEY, '[]'); // initialised: no migration at app start
    await mountImportModal();
    fireEvent.click(screen.getByRole('button', { name: 'Risks' }));
    await chooseAndWait('Asset ID,Threat\nAST-001,Flood\n');
    fireEvent.click(modalImportButton());
    await screen.findByText('Imported 1 new risks.');
    const after = localStorage.getItem(RISKS_KEY)!;
    expect(after.startsWith(legacy.slice(0, -1))).toBe(true);
    expect((JSON.parse(after) as Risk[]).map((r) => r.id)).toEqual(['RSK-001', 'RSK-002']);
  });
});

describe('Step 4 · ImportExport (standalone): real repository, outcomes and refresh', () => {
  function mountVendors(onRefreshed = vi.fn()) {
    const existing = vendorRepo.list(); // normal module start (seeds the key)
    render(
      <UiProvider>
        <ImportExport spec={vendorIo} exportSource={existing} existing={existing} canImport canExport={false} repo={vendorRepo} onRefreshed={onRefreshed} />
      </UiProvider>,
    );
    return { onRefreshed, existing };
  }
  const rowButton = () => screen.getByRole('button', { name: /^Import \d+ rows?/ }) as HTMLButtonElement;

  it('preview lists assigned IDs and names; COMMITTED refreshes the page from storage; bulkSave is never used', async () => {
    const { onRefreshed, existing } = mountVendors();
    const bulkSave = vi.spyOn(vendorRepo, 'bulkSave');
    await chooseAndWait('Name\nAcme Imports\n');
    const nextId = `VEN-${String(Math.max(...existing.map((v) => Number(v.id.slice(4)))) + 1).padStart(2, '0')}`;
    expect(screen.getByText(nextId)).toBeTruthy();
    expect(screen.getByText(/Acme Imports/)).toBeTruthy();
    fireEvent.click(rowButton());
    expect(await screen.findByText('Imported 1 new vendors.')).toBeTruthy();
    expect(bulkSave).not.toHaveBeenCalled();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(onRefreshed.mock.calls[0][0]).toEqual(JSON.parse(localStorage.getItem(VENDORS_KEY)!));
    expect((onRefreshed.mock.calls[0][0] as Vendor[]).map((v) => v.name)).toContain('Acme Imports');
    expect(JSON.parse(localStorage.getItem(AUDIT_KEY)!)[0].summary).toBe('Imported 1 Vendor from CSV (1 new, 0 updated)'); // bulkSave's wording, unchanged
  });

  it('REJECTED (module key removed after the preview): message shown, page not refreshed, key NOT seeded', async () => {
    const { onRefreshed } = mountVendors();
    await chooseAndWait('Name\nLate\n');
    localStorage.removeItem(VENDORS_KEY);
    const setItem = watchWrites();
    fireEvent.click(rowButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/^The stored Vendors collection is missing/);
    expect(onRefreshed).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(VENDORS_KEY)).toBeNull();
    expect(rowButton().disabled).toBe(true);
  });

  it('COMMITTED, AUDIT NOT RECORDED: warning, page refreshed from storage', async () => {
    const { onRefreshed } = mountVendors();
    await chooseAndWait('Name\nNo audit vendor\n');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === AUDIT_KEY) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, k, v);
    });
    fireEvent.click(rowButton());
    expect(await screen.findByText(/were imported, but the audit log could not be updated/)).toBeTruthy();
    expect(onRefreshed).toHaveBeenCalledTimes(1);
  });

  it('UNCERTAIN with an unreadable read-back: message shown, page not refreshed, Import disabled', async () => {
    const { onRefreshed } = mountVendors();
    await chooseAndWait('Name\nUncertain vendor\n');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === VENDORS_KEY) { realSetItem.call(this, k, '[null]'); throw new Error('late'); }
      realSetItem.call(this, k, v);
    });
    fireEvent.click(rowButton());
    expect((await screen.findByRole('alert')).textContent).toMatch(/may or may not have been saved, and the stored data could not be read back/);
    expect(onRefreshed).not.toHaveBeenCalled();
    expect(rowButton().disabled).toBe(true);
  });
});

describe('Step 4 · no old import path remains reachable (source scan)', () => {
  const sources = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const app = Object.entries(sources).filter(([path]) => !/\.test\.tsx?$/.test(path) && !path.includes('/test/'));

  it('no application file calls bulkSave or the removed store import methods', () => {
    expect(app.length).toBeGreaterThan(50);
    const offenders = app
      .filter(([path]) => !path.endsWith('/data/createLocalRepo.ts')) // the definition itself
      .filter(([, src]) => /\.bulkSave\(|\bimportAssets\b|\bimportRisks\b|\bimportTreatments\b|onImported/.test(src))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('all 10 standalone import pages pass their repository and a storage-refresh callback; the RCSA modal uses store.importNew', () => {
    const pages = app.filter(([path, src]) => /\/modules\/[a-z]+\/[A-Za-z]+Page\.tsx$/.test(path) && /<ImportExport/.test(src));
    expect(pages).toHaveLength(10);
    pages.forEach(([path, src]) => expect(src, path).toMatch(/<ImportExport [^>]*repo=\{\w+Repo\} onRefreshed=\{set\w+\}/));
    const modal = app.find(([path]) => path.endsWith('/components/ImportModal.tsx'));
    expect(modal?.[1]).toMatch(/store\.importNew\(tab, result\.rows\)/);
  });
});
