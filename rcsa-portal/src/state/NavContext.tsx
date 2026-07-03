import { createContext, useContext } from 'react';

// Lets pages trigger navigation (e.g. "Open in Risk Catalogue") without
// clearing the active filter, so a dashboard drill-down carries its slice.
export interface NavApi {
  activeId: string;
  navigate(moduleId: string): void;
}

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavContext');
  return ctx;
}
