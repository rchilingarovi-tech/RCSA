import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { MODULE_IDS } from '../modules/registry';
import { userStore } from './userStore';
import { grantsStore } from './grantsStore';
import { hashPassword, verifyPassword } from './passwordPolicy';
import { resolveAccess, type AppUser, type GrantMap, type Role, type Session, type StoredUser } from './types';
import { auditLog, diffFields } from '../audit/auditLog';
import { UPN_DOMAIN } from '../config';

// The identity + rights seam. Today it authenticates against a local user store
// (demo). After migration this is the ONLY place that changes — it will obtain the
// session from the server (LDAP bind + group→role mapping). Everything downstream
// (useAuth/useSession, can(), menus, audit actor) is untouched.

const KEY = 'infosec.auth.session';

export interface UserInput {
  displayName: string;
  sAMAccountName: string;
  email: string;
  title: string;
  groups: string[];
  defaultRole: Role | null;
  isAdmin: boolean;
}

interface AuthCtx {
  session: Session | null;
  users: AppUser[];
  login: (login: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  /** Demo-only: become another user without a password (fast persona switching). */
  switchUser: (id: string) => void;
  canManageRights: boolean;
  getUserAccess: (userId: string) => GrantMap;
  setUserGrants: (userId: string, grants: GrantMap) => void;
  resetGrants: () => void;
  // User management (admin)
  createUser: (input: UserInput, password: string) => void;
  updateUser: (id: string, input: UserInput) => void;
  setUserActive: (id: string, active: boolean) => void;
  setUserPassword: (id: string, password: string) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function readSessionId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function effectiveAccess(user: AppUser): GrantMap {
  const override = grantsStore.get(user.id);
  if (!override) return resolveAccess(user, MODULE_IDS);
  // Keep only gateable modules — drops any stale entries (e.g. footer items
  // saved before MODULE_IDS excluded them) so access counts stay correct.
  const allowed = new Set(MODULE_IDS);
  const clean: GrantMap = {};
  for (const id of Object.keys(override)) if (allowed.has(id)) clean[id] = override[id];
  return clean;
}

/** Strip credentials before a user goes into a Session. */
function toAppUser(u: StoredUser): AppUser {
  const { passwordHash: _omit, ...appUser } = u;
  void _omit;
  return appUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(readSessionId);
  const [tick, setTick] = useState(0); // bumped when users/grants change, to recompute

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem(KEY, currentUserId);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore persistence failure */
    }
  }, [currentUserId]);

  const session = useMemo<Session | null>(() => {
    if (!currentUserId) return null;
    const stored = userStore.get(currentUserId);
    if (!stored || !stored.active) return null;
    const user = toAppUser(stored);
    return { user, groups: user.groups, access: effectiveAccess(user) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, tick]);

  // Keep the audit actor in sync with whoever is signed in.
  useEffect(() => {
    if (session) auditLog.setActor(session.user.displayName);
  }, [session]);

  const value = useMemo<AuthCtx>(() => {
    const audit = (action: 'create' | 'update' | 'delete' | 'session' | 'rights', entity: string, entityId: string, summary: string, changes?: ReturnType<typeof diffFields>) =>
      auditLog.record({ action, entity, entityId, summary, changes });

    return {
      session,
      users: userStore.list(),
      login: (login, password) => {
        const u = userStore.getByLogin(login);
        if (!u || !u.active) return { ok: false, error: 'Account not found or inactive.' };
        if (!verifyPassword(password, u.passwordHash)) return { ok: false, error: 'Incorrect username or password.' };
        auditLog.setActor(u.displayName);
        audit('session', 'Session', u.id, `Signed in as ${u.displayName} (${u.title})`);
        setCurrentUserId(u.id);
        return { ok: true };
      },
      logout: () => {
        audit('session', 'Session', session?.user.id ?? '', `Signed out${session ? ` (${session.user.displayName})` : ''}`);
        setCurrentUserId(null);
      },
      switchUser: (id) => {
        const u = userStore.get(id);
        if (!u || !u.active) return;
        auditLog.setActor(u.displayName);
        audit('session', 'Session', id, `Switched to ${u.displayName} (demo)`);
        setCurrentUserId(id);
      },
      canManageRights: session?.user.isAdmin ?? false,
      getUserAccess: (id) => {
        const u = userStore.get(id);
        return u ? effectiveAccess(u) : {};
      },
      setUserGrants: (id, grants) => {
        const target = userStore.get(id);
        const before = target ? effectiveAccess(target) : {};
        grantsStore.set(id, grants);
        audit('rights', 'Access rights', id, `Updated access rights for ${target?.displayName ?? id}`, diffFields(before as Record<string, unknown>, grants as Record<string, unknown>));
        setTick((t) => t + 1);
      },
      resetGrants: () => {
        grantsStore.reset();
        audit('rights', 'Access rights', '', 'Reset all access rights to directory defaults');
        setTick((t) => t + 1);
      },
      createUser: (input, password) => {
        const user: StoredUser = {
          id: userStore.nextId(),
          upn: `${input.sAMAccountName}@${UPN_DOMAIN}`,
          sAMAccountName: input.sAMAccountName,
          displayName: input.displayName,
          title: input.title,
          email: input.email || `${input.sAMAccountName}@${UPN_DOMAIN}`,
          groups: input.groups,
          isAdmin: input.isAdmin,
          active: true,
          defaultRole: input.defaultRole,
          overrides: {},
          passwordHash: hashPassword(password),
        };
        userStore.save(user);
        audit('create', 'User', user.id, `Created user ${user.displayName} (${user.sAMAccountName})`);
        setTick((t) => t + 1);
      },
      updateUser: (id, input) => {
        const u = userStore.get(id);
        if (!u) return;
        const updated: StoredUser = { ...u, ...input, upn: `${input.sAMAccountName}@${UPN_DOMAIN}`, email: input.email || `${input.sAMAccountName}@${UPN_DOMAIN}` };
        userStore.save(updated);
        audit('update', 'User', id, `Updated user ${updated.displayName}`, diffFields(u as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>));
        setTick((t) => t + 1);
      },
      setUserActive: (id, active) => {
        const u = userStore.get(id);
        if (!u) return;
        userStore.save({ ...u, active });
        audit('update', 'User', id, `${active ? 'Enabled' : 'Disabled'} user ${u.displayName}`);
        // If we just disabled the signed-in user, log them out.
        if (!active && currentUserId === id) setCurrentUserId(null);
        setTick((t) => t + 1);
      },
      setUserPassword: (id, password) => {
        const u = userStore.get(id);
        if (!u) return;
        userStore.save({ ...u, passwordHash: hashPassword(password) });
        audit('update', 'User', id, `Reset password for ${u.displayName}`);
        setTick((t) => t + 1);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentUserId, tick]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used within AuthProvider');
  return v;
}

/** For components rendered only when signed in — returns the guaranteed Session. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error('useSession used without an active session');
  return session;
}
