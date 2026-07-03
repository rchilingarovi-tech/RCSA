import type { GrantMap } from './types';

// Persists admin-edited per-user rights (Settings → Access Control). Keyed by
// userId. When present for a user it OVERRIDES their seed role config; absent =
// fall back to the seed. Migration: this becomes a server call, same shape.
const KEY = 'infosec.auth.grants.v1';

type Store = Record<string, GrantMap>; // userId → grants

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export const grantsStore = {
  get(userId: string): GrantMap | null {
    return read()[userId] ?? null;
  },
  set(userId: string, grants: GrantMap): void {
    const s = read();
    s[userId] = grants;
    write(s);
  },
  reset(): void {
    write({});
  },
};
