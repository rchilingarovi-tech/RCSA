import type { StoredUser } from './types';
import { SEED_USERS } from './seed';

// Mutable local user directory (Phase 4). Seeded from SEED_USERS on first run.
// Migration: replace with server-managed users / AD sync — the AuthProvider seam
// is the only consumer.
const KEY = 'infosec.auth.users.v1';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function write(users: StoredUser[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(users));
  } catch {
    /* storage unavailable */
  }
}

function read(): StoredUser[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) {
      write(SEED_USERS);
      return clone(SEED_USERS);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : clone(SEED_USERS);
  } catch {
    return clone(SEED_USERS);
  }
}

export const userStore = {
  list(): StoredUser[] {
    return read();
  },
  get(id: string): StoredUser | null {
    return read().find((u) => u.id === id) ?? null;
  },
  /** Match by sAMAccountName, UPN or email (case-insensitive). */
  getByLogin(login: string): StoredUser | null {
    const q = login.trim().toLowerCase();
    if (!q) return null;
    return read().find((u) =>
      u.sAMAccountName.toLowerCase() === q || u.upn.toLowerCase() === q || u.email.toLowerCase() === q,
    ) ?? null;
  },
  /** Is this login name already taken (optionally excluding one user id)? */
  loginTaken(login: string, exceptId?: string): boolean {
    const q = login.trim().toLowerCase();
    return read().some((u) => u.id !== exceptId && u.sAMAccountName.toLowerCase() === q);
  },
  save(user: StoredUser): StoredUser[] {
    const all = read();
    const i = all.findIndex((u) => u.id === user.id);
    if (i === -1) all.push(user);
    else all[i] = user;
    write(all);
    return all;
  },
  remove(id: string): StoredUser[] {
    const all = read().filter((u) => u.id !== id);
    write(all);
    return all;
  },
  reset(): StoredUser[] {
    const fresh = clone(SEED_USERS);
    write(fresh);
    return fresh;
  },
  nextId(): string {
    return `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  },
};
