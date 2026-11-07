// ID integrity S2 §4.4 — checked batch audit (auditLog.recordBatchChecked).
// Existing record() / list() / reset() / subscribe() behaviour is unchanged.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { auditLog, type AuditEvent, type AuditInput } from './auditLog';

const KEY = 'infosec.audit.v1';
const originalSetItem = Storage.prototype.setItem;
const originalGetItem = Storage.prototype.getItem;

const INPUTS: AuditInput[] = [
  { action: 'create', entity: 'Asset', entityId: 'AST-001', summary: 'Created Asset AST-001 — A', changes: [{ field: 'name', from: '∅', to: 'A' }] },
  { action: 'create', entity: 'Asset', entityId: 'AST-002', summary: 'Created Asset AST-002 — B', changes: [] },
  { action: 'create', entity: 'Vendor', summary: 'Imported 1 Vendor from CSV (1 new, 0 updated)' },
];
/** Everything except the random id and the timestamp. */
const view = (events: AuditEvent[]) => events.map(({ id: _id, ts: _ts, ...rest }) => rest);

afterEach(() => { vi.restoreAllMocks(); auditLog.setActor('System'); });

describe('recordBatchChecked: recorded', () => {
  it('stores exactly what N sequential record() calls store (fields, order, actor, empty changes omitted)', () => {
    auditLog.setActor('Alice');
    localStorage.setItem(KEY, JSON.stringify([]));
    INPUTS.forEach((e) => auditLog.record(e));
    const sequential = auditLog.list();

    localStorage.setItem(KEY, JSON.stringify([]));
    const result = auditLog.recordBatchChecked(INPUTS);
    expect(result).toEqual({ status: 'recorded', count: 3, listenerErrors: 0 });
    const batch = auditLog.list();
    expect(view(batch)).toEqual(view(sequential));
    expect(batch[0].summary).toMatch(/Imported 1 Vendor/); // newest first
    expect(batch[2].actor).toBe('Alice');
    expect('changes' in batch[1]).toBe(false);
    expect(batch.every((e) => /^EVT-[0-9a-z]+-[0-9a-z]{1,5}$/.test(e.id))).toBe(true);
  });

  it('prepends to the existing log, keeps it, and respects the 1,000-event cap', () => {
    const old = Array.from({ length: 999 }, (_, i) => ({ id: `EVT-old-${i}`, ts: 't', actor: 'x', action: 'update', entity: 'X', entityId: '', summary: `old ${i}` }));
    localStorage.setItem(KEY, JSON.stringify(old));
    expect(auditLog.recordBatchChecked(INPUTS.slice(0, 2)).status).toBe('recorded');
    const stored = auditLog.list();
    expect(stored).toHaveLength(1000);
    expect(stored.slice(0, 2).map((e) => e.entityId)).toEqual(['AST-002', 'AST-001']);
    expect(stored[2].summary).toBe('old 0');
    expect(stored[999].summary).toBe('old 997'); // the oldest event dropped by the cap, exactly as record() does
  });

  it('a missing log is treated as empty; listeners are notified once per batch', () => {
    const listener = vi.fn();
    const unsubscribe = auditLog.subscribe(listener);
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('recorded');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(auditLog.list()).toHaveLength(3);
  });
});

describe('recordBatchChecked: not-recorded (nothing written)', () => {
  it.each(['{}', '"x"', 'not json', '{"length":1}'])('an unreadable or non-array stored log (%s) is never overwritten', (raw) => {
    localStorage.setItem(KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const listener = vi.fn();
    const unsubscribe = auditLog.subscribe(listener);
    expect(auditLog.recordBatchChecked(INPUTS)).toEqual({ status: 'not-recorded', count: 3, listenerErrors: 0 });
    unsubscribe();
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).toBe(raw);
  });

  it('getItem throwing: not-recorded, no write', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('not-recorded');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('setItem throws (quota) and the log is unchanged: not-recorded, attempted once', () => {
    localStorage.setItem(KEY, '[]');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('not-recorded');
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBe('[]');
  });
});

describe('recordBatchChecked: uncertain', () => {
  it('setItem writes and then throws', () => {
    localStorage.setItem(KEY, '[]');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      originalSetItem.call(this, k, v);
      throw new Error('late');
    });
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('uncertain');
  });

  it('the read-back differs from what was written', () => {
    localStorage.setItem(KEY, '[]');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string) {
      originalSetItem.call(this, k, '[{"id":"EVT-other"}]');
    });
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('uncertain');
  });

  it('the read-back throws', () => {
    localStorage.setItem(KEY, '[]');
    let wrote = false;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) { originalSetItem.call(this, k, v); wrote = true; });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (wrote) throw new Error('read-back failed');
      return originalGetItem.call(this, k);
    });
    expect(auditLog.recordBatchChecked(INPUTS).status).toBe('uncertain');
  });
});

describe('recordBatchChecked: listeners are isolated', () => {
  it('a throwing listener is counted and logged; other listeners still run; the status stays recorded', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = auditLog.subscribe(() => { throw new Error('listener boom'); });
    const good = vi.fn();
    const unsubscribeGood = auditLog.subscribe(good);
    expect(auditLog.recordBatchChecked(INPUTS)).toEqual({ status: 'recorded', count: 3, listenerErrors: 1 });
    expect(good).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
    bad();
    unsubscribeGood();
  });
});

describe('existing audit APIs are unchanged', () => {
  it('record() / list() / reset() still behave as before', () => {
    auditLog.record({ action: 'update', entity: 'Risk', entityId: 'RSK-001', summary: 'Updated Risk RSK-001' });
    expect(auditLog.list().map((e) => [e.action, e.entityId, e.summary])).toEqual([['update', 'RSK-001', 'Updated Risk RSK-001']]);
    auditLog.reset();
    expect(auditLog.list()).toEqual([]);
  });
});
