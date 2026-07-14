// Generic localStorage repository factory for the standalone modules.
// Each module gets its OWN instance (own key + seed), so data stays separate —
// this only removes the duplicated CRUD boilerplate, it does not couple modules.
// Migration-ready: swap this one factory for an HTTP/DB client later.
import { auditLog, diffFields } from '../audit/auditLog';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export interface LocalRepo<T> {
  list(): T[];
  save(item: T): T[];
  /** Upsert many in ONE write with ONE summarizing audit event (CSV import). */
  bulkSave(items: T[]): T[];
  remove(id: string): T[];
  reset(): T[];
  /** Next sequential id, e.g. "CTL-001", derived from the current set. */
  nextId(): string;
}

export function createLocalRepo<T extends { id: string }>(opts: {
  key: string;
  seed: T[];
  idPrefix: string;
  pad?: number;
  /** Human label for audit events, e.g. "Vendor". Defaults to idPrefix. */
  entity?: string;
  /** Human description of a record for audit summaries. Defaults to "<entity> <id>". */
  describe?: (item: T) => string;
  /** Field names whose VALUES must not be copied into the audit trail (sensitive
   *  free text, e.g. incident descriptions). The audit still records THAT the
   *  field changed — just not its content. */
  auditRedact?: (keyof T & string)[];
}): LocalRepo<T> {
  const { key, seed, idPrefix, pad = 3, entity = idPrefix, describe, auditRedact = [] } = opts;
  const label = (item: T) => (describe ? describe(item) : `${entity} ${item.id}`);
  const redactSet = new Set<string>(auditRedact);
  const redact = (changes: ReturnType<typeof diffFields>) =>
    changes.map((c) => (redactSet.has(c.field) ? { ...c, from: '[redacted]', to: '[updated]' } : c));

  function write(v: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable (private mode) — fail silently */
    }
  }

  function read(): T[] {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) {
        write(seed);
        return clone(seed);
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : clone(seed);
    } catch {
      return clone(seed);
    }
  }

  return {
    list: read,
    save(item: T): T[] {
      const all = read();
      const idx = all.findIndex((x) => x.id === item.id);
      const isNew = idx === -1;
      const before = isNew ? null : all[idx];
      if (isNew) all.push(item);
      else all[idx] = item;
      write(all);
      const changes = redact(
        isNew
          ? diffFields({}, item as Record<string, unknown>)
          : diffFields(before as Record<string, unknown>, item as Record<string, unknown>),
      );
      auditLog.record({
        action: isNew ? 'create' : 'update',
        entity,
        entityId: item.id,
        summary: `${isNew ? 'Created' : 'Updated'} ${label(item)}`,
        changes,
      });
      return all;
    },
    bulkSave(items: T[]): T[] {
      if (items.length === 0) return read();
      const all = read();
      let created = 0;
      let updated = 0;
      items.forEach((item) => {
        const idx = all.findIndex((x) => x.id === item.id);
        if (idx === -1) { all.push(item); created += 1; }
        else { all[idx] = item; updated += 1; }
      });
      write(all);
      auditLog.record({
        action: updated === 0 ? 'create' : 'update',
        entity,
        summary: `Imported ${items.length} ${entity}${items.length === 1 ? '' : 's'} from CSV (${created} new, ${updated} updated)`,
      });
      return all;
    },
    remove(id: string): T[] {
      const existing = read();
      const item = existing.find((x) => x.id === id);
      const all = existing.filter((x) => x.id !== id);
      write(all);
      auditLog.record({
        action: 'delete',
        entity,
        entityId: id,
        summary: `Deleted ${item ? label(item) : `${entity} ${id}`}`,
        changes: item ? redact(diffFields(item as Record<string, unknown>, {})) : undefined,
      });
      return all;
    },
    reset(): T[] {
      const fresh = clone(seed);
      write(fresh);
      auditLog.record({ action: 'reset', entity, summary: `Reset ${entity} demo data` });
      return fresh;
    },
    nextId(): string {
      const max = read().reduce((m, x) => {
        const n = Number(String(x.id).replace(/\D/g, ''));
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      return `${idPrefix}-${String(max + 1).padStart(pad, '0')}`;
    },
  };
}
