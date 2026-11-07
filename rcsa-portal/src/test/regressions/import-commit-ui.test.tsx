// ID integrity S2 — Step 1 UI guard (design §9.1 T-UI, first part; the full
// preview table and commit outcomes are S2 step 4).
// A file with ANY error must not reach the existing import operation: the
// Import button is disabled, clicking it does nothing, and no storage key
// changes. File errors (strict CSV grammar) are shown, not hidden.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UiProvider } from '../../components/common/UiProvider';
import { ImportExport } from '../../components/common/ImportExport';
import { ImportModal } from '../../components/ImportModal';
import { AppStoreProvider, useStore } from '../../state/AppStore';
import { vendorIo } from '../../modules/vendors/io';
import { csvFile } from '../helpers';

const snapshot = () => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)]));
/** Spy on every localStorage write from now on (restored after each test). */
const watchWrites = () => vi.spyOn(Storage.prototype, 'setItem');
afterEach(() => { vi.restoreAllMocks(); });

function chooseFile(container: HTMLElement, text: string) {
  const input = (container.querySelector('input[type="file"]') ?? document.querySelector('input[type="file"]')) as HTMLInputElement;
  fireEvent.change(input, { target: { files: [csvFile(text)] } });
}

describe('Standalone ImportExport: any error blocks the import', () => {
  it('a valid row next to an explicit-ID row: Import is disabled and onImported is never called', async () => {
    const onImported = vi.fn();
    const { container } = render(
      <UiProvider>
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} onImported={onImported} />
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
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} onImported={vi.fn()} />
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
        <ImportExport spec={vendorIo} exportSource={[]} existing={[]} canImport canExport={false} onImported={onImported} />
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
