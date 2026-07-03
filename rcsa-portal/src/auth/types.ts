// Identity + rights model — Phase 0/1 of the enterprise escalation.
// Shaped like Active Directory so the future server (LDAP bind + group sync) can
// populate it unchanged. This is the seam: a mock session now, a real one later.
//
// Rights are ACTION-level per module (the checkboxes in Settings → Access Control).
// Roles are just presets that fill those checkboxes. NOTE: nothing here is a real
// security control — the demo enforces `view` in the menu for UX; the server must
// re-check every action after migration.

export type Role = 'admin' | 'editor' | 'viewer';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'export';
export const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'export'];
export const ACTION_LABELS: Record<Action, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
};

/** A role expands to a set of allowed actions. */
export function rolePreset(role: Role): Action[] {
  switch (role) {
    case 'admin':
      return ['view', 'create', 'edit', 'delete', 'export'];
    case 'editor':
      return ['view', 'create', 'edit', 'export'];
    case 'viewer':
      return ['view'];
  }
}

/** Per-module action grants: moduleId → allowed actions. */
export type GrantMap = Record<string, Action[]>;

export interface AppUser {
  id: string;
  upn: string; // userPrincipalName, e.g. n.gelashvili@lb.ge
  sAMAccountName: string; // legacy AD login
  displayName: string;
  title: string; // job title — shown in the UI
  email: string;
  groups: string[]; // AD memberOf (CN list) — the real source of rights after migration
  isAdmin: boolean; // may administer access rights (demo gate for Settings → Access Control)
  active: boolean; // disabled accounts cannot sign in (leaver handling)
  // Mock of what the server will resolve from `groups` (the group→{module,role}
  // mapping arrives with the backend). Kept as data so the seam stays clean.
  defaultRole: Role | null; // baseline across all modules (null = no access by default)
  overrides: Record<string, Role>; // per-module role overrides (moduleId → role)
}

/** A user as stored locally — identity + demo credentials. Never put the hash in a Session. */
export interface StoredUser extends AppUser {
  passwordHash: string;
}

export interface Session {
  user: AppUser;
  groups: string[];
  access: GrantMap; // moduleId → effective allowed actions (absent = no access)
}

/** Resolve a user's effective per-module grants from their seed role config. */
export function resolveAccess(user: AppUser, moduleIds: string[]): GrantMap {
  const access: GrantMap = {};
  for (const id of moduleIds) {
    const role = user.overrides[id] ?? user.defaultRole;
    if (role) access[id] = rolePreset(role);
  }
  return access;
}
