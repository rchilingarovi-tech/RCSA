# Active Directory / LDAP integration — handoff notes

Status: **front-end contract is ready; the bind itself is a backend task.** This
document is for the dev / ITops team who will wire the demo to a real directory.

## Principle

The browser **never** talks to LDAP/AD directly (credentials, network exposure,
and authorization all belong on the server). The front end only ever consumes a
**Session** object. Today that session is mocked locally (the "view as" switcher
in the header); in production it comes from the server after an AD bind. Nothing
in the UI changes — only the source of the session.

## The seam

One file is the entire integration point on the client:
`src/auth/AuthProvider.tsx`. Replace the mock (`SEED_USERS` + `localStorage`)
with a fetch of the current session from the server. Everything downstream
(`useAuth`, `can()`, `usePermissions`, menus, action buttons, audit actor) is
unchanged.

### Session contract (`src/auth/types.ts`)

```ts
interface AppUser {
  id; upn; sAMAccountName; displayName; title; email;
  groups: string[];          // AD memberOf (CN list)
  isAdmin: boolean;          // may administer access rights
}
interface Session {
  user: AppUser;
  groups: string[];
  access: Record<moduleId, Action[]>;  // effective per-module rights
}
```

`AppUser` is intentionally AD-shaped (`upn`, `sAMAccountName`, `memberOf` groups).

## Server-side flow to implement

1. App posts credentials to `POST /auth/login` (or redirect to SSO / OIDC).
2. Server performs the **LDAP/AD bind** to validate the credentials.
3. Server reads the account's `memberOf` groups.
4. Server maps groups → platform access using the **group→role map**
   (`src/auth/groupRoleMap.ts` documents the intended mapping; move it server-side
   and make it the authoritative source).
5. Server returns a **signed session** (JWT or secure HTTP-only cookie) carrying
   identity + resolved `access`.
6. Client renders menus/actions from the session — **and the server re-checks
   `can(action, module)` on every mutating request.** Client checks are UX only.

## Group → role mapping

The demo ships a documented mapping in `src/auth/groupRoleMap.ts` and shows it in
**Governance → Directory**. Make this configurable (admin-managed table) and
authoritative on the server. Per-user overrides (the Settings → Access Control
matrix, stored in `infosec.auth.grants.v1`) become server-side exceptions layered
on top of the group-derived baseline.

## Related

- RBAC enforcement: `src/auth/can.ts`, `usePermissions.ts` (mirror server-side).
- Audit actor: `AuthProvider` calls `auditLog.setActor(session.user.displayName)`.
- See also the in-app **Governance → Directory** page for the visual model.
