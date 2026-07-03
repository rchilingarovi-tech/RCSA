import { createContext } from 'react';

// DOM node in the shell header where the active page portals its action buttons.
// Lets each page own its actions without a second, redundant header band.
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
