import { useSession } from './AuthProvider';
import { can } from './can';

// Per-module permission flags for gating action buttons. UX only — the server
// must re-check the same actions after migration.
export function usePermissions(moduleId: string) {
  const session = useSession();
  return {
    view: can(session, 'view', moduleId),
    create: can(session, 'create', moduleId),
    edit: can(session, 'edit', moduleId),
    remove: can(session, 'delete', moduleId),
    export: can(session, 'export', moduleId),
  };
}
