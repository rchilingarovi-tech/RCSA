// One-shot navigation intent — lets a cross-module link carry WHAT it was about,
// not just where to go. Two forms:
//   new:<moduleId>              → open the New form on arrival (Quick Actions)
//   open:<moduleId>:<recordId>  → open that record's detail on arrival (drill-through)
// sessionStorage so it never outlives the browser tab, and it is consumed once so
// a later refresh doesn't re-open the record.
const KEY = 'infosec.nav.intent';

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function clear(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function setIntent(value: string): void {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable — navigation degrades to a plain module switch */
  }
}

/** Queue "open this record" for the target module. */
export function setOpenIntent(moduleId: string, recordId: string): void {
  setIntent(`open:${moduleId}:${recordId}`);
}

/** Consume the intent if it matches exactly; returns whether it fired. */
export function takeIntent(value: string): boolean {
  if (read() === value) {
    clear();
    return true;
  }
  return false;
}

/** Consume an `open:` intent for this module; returns the record id, or null. */
export function takeOpenIntent(moduleId: string): string | null {
  const raw = read();
  const prefix = `open:${moduleId}:`;
  if (raw && raw.startsWith(prefix)) {
    clear();
    return raw.slice(prefix.length);
  }
  return null;
}
