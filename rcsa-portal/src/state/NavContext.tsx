import { createContext, useContext } from 'react';

// Lets pages trigger navigation without clearing the active filter, so a
// dashboard drill-down carries its slice. Passing a recordId also carries WHICH
// record the link was about, so the target page can open it on arrival instead
// of dropping the user on an unfiltered page 1.
export interface NavApi {
  activeId: string;
  navigate(moduleId: string, recordId?: string): void;
}

export const NavContext = createContext<NavApi | null>(null);

export function useNav(): NavApi {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavContext');
  return ctx;
}
