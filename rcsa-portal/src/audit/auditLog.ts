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
