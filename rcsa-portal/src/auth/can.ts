import type { Action, Session } from './types';

// The single permission check. UI uses this to gate menus/buttons. After
// migration the SERVER must run the same logic — client checks are UX only.
export function can(session: Session, action: Action, moduleId: string): boolean {
  return (session.access[moduleId] ?? []).includes(action);
}

export function canView(session: Session, moduleId: string): boolean {
  return can(session, 'view', moduleId);
}
