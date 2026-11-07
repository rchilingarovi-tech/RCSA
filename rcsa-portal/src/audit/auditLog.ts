// Audit trail seam — Phase 2 of the enterprise escalation.
// Append-only (newest-first) ring buffer in localStorage. A module-level "current
// actor" is set by AuthProvider so the non-React repos can attribute events.
// Migration: point `record()` at a server append-only store; everything else stays.
//
// HONEST: a client-side log is NOT tamper-proof (a user can edit localStorage).
// The real audit trail lives server-side after migration. This is the demo + spec.

export type AuditAction = 'create' | 'update' | 'delete' | 'reset' | 'rights' | 'session';

/** A single field-level change (the "what specifically changed"). */
export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface AuditEvent {
  id: string;
  ts: string; // ISO timestamp
  actor: string; // who (display name)
  action: AuditAction;
  entity: string; // what kind of thing (e.g. "Vendor", "Risk")
  entityId: string; // record id (may be empty)
  summary: string; // human-readable description
  changes?: FieldChange[]; // per-field before→after (updates) or initial values (create)
}

const MAX_VAL = 140;

/** Render any value as a short display string for the audit trail. */
export function auditValue(v: unknown): string {
  if (v == null || v === '') return '∅';
  let s: string;
  if (Array.isArray(v)) s = v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  return s.length > MAX_VAL ? `${s.slice(0, MAX_VAL)}…` : s;
}

/** Top-level field diff between two records (changed fields only). */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: FieldChange[] = [];
  for (const k of keys) {
    const from = auditValue(before?.[k]);
    const to = auditValue(after?.[k]);
    if (from !== to) out.push({ field: k, from, to });
  }
  return out;
}

const KEY = 'infosec.audit.v1';
const CAP = 1000;

let currentActor = 'System';
const listeners = new Set<() => void>();

/** One event to record (same shape `record()` accepts). */
export interface AuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string;
  summary: string;
  actor?: string;
  changes?: FieldChange[];
}

/**
 * Result of `recordBatchChecked` (ID integrity S2 §4.4):
 *  • recorded     — the read-back equals exactly what was written;
 *  • not-recorded — nothing was written: the stored log is unreadable / not an
 *                   array (left untouched), or setItem threw and the value is
 *                   provably unchanged;
 *  • uncertain    — the write may or may not have happened.
 * `listenerErrors` counts subscribers that threw; it never changes `status`.
 */
export interface AuditBatchResult {
  status: 'recorded' | 'not-recorded' | 'uncertain';
  count: number;
  listenerErrors: number;
}

/** Builds an event exactly as `record()` does. */
function buildEvent(e: AuditInput): AuditEvent {
  return {
    id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    actor: e.actor ?? currentActor,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId ?? '',
    summary: e.summary,
    ...(e.changes && e.changes.length ? { changes: e.changes } : {}),
  };
}

/** Notify subscribers, each isolated: a throwing listener is logged and counted. */
function notifyIsolated(): number {
  let errors = 0;
  listeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      errors += 1;
      console.error('Audit log listener failed', err);
    }
  });
  return errors;
}

function read(): AuditEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: AuditEvent[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    /* storage unavailable */
  }
}

export const auditLog = {
  /** Set the actor attributed to subsequent events (called by AuthProvider). */
  setActor(name: string): void {
    currentActor = name || 'System';
  },

  record(e: { action: AuditAction; entity: string; entityId?: string; summary: string; actor?: string; changes?: FieldChange[] }): void {
    const ev: AuditEvent = {
      id: `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      actor: e.actor ?? currentActor,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId ?? '',
      summary: e.summary,
      ...(e.changes && e.changes.length ? { changes: e.changes } : {}),
    };
    write([ev, ...read()].slice(0, CAP));
    listeners.forEach((l) => l());
  },

  /**
   * ID integrity S2 §4.4 — record several events in ONE checked write.
   * The stored order equals N sequential `record()` calls ([evN … ev1, …prev]),
   * capped at CAP like `record()`. The write is NOT swallowed and is read back;
   * an unreadable stored log is never overwritten. No retry. Existing
   * `record()` / `list()` / `reset()` / `subscribe()` are unchanged.
   */
  recordBatchChecked(inputs: AuditInput[]): AuditBatchResult {
    const count = inputs.length;
    let raw: string | null;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      return { status: 'not-recorded', count, listenerErrors: 0 };
    }
    let prev: unknown = [];
    if (raw !== null) {
      try {
        prev = JSON.parse(raw);
      } catch {
        return { status: 'not-recorded', count, listenerErrors: 0 };
      }
    }
    if (!Array.isArray(prev)) return { status: 'not-recorded', count, listenerErrors: 0 };
    if (count === 0) return { status: 'recorded', count, listenerErrors: 0 };

    const events = inputs.map(buildEvent);
    const next = JSON.stringify([...events.slice().reverse(), ...(prev as AuditEvent[])].slice(0, CAP));

    let threw = false;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      threw = true;
    }
    let status: AuditBatchResult['status'];
    try {
      const readBack = localStorage.getItem(KEY);
      if (threw) status = readBack === raw ? 'not-recorded' : 'uncertain';
      else status = readBack === next ? 'recorded' : 'uncertain';
    } catch {
      status = 'uncertain';
    }
    const listenerErrors = status === 'not-recorded' ? 0 : notifyIsolated();
    return { status, count, listenerErrors };
  },

  list(): AuditEvent[] {
    return read();
  },

  reset(): void {
    write([]);
    listeners.forEach((l) => l());
  },

  /** Subscribe to changes (for the live Audit Log view). Returns an unsubscribe. */
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
