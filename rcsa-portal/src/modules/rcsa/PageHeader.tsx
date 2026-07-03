import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HeaderSlotContext } from '../../components/layout/HeaderSlot';

/**
 * Portals a page's action buttons into the shell header. The page title/subtitle
 * already live in the shell header (from the module registry), so there is no
 * separate band — this renders nothing inline.
 */
export function PageHeader({ children }: { children?: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  if (!slot || !children) return null;
  return createPortal(<div className="flex flex-wrap items-center gap-2">{children}</div>, slot);
}
