import type { KeyboardEvent } from 'react';

/**
 * Makes a clickable table row reachable and operable by keyboard. A `<tr onClick>`
 * with no tabIndex is mouse-only: the primary way into a record was unusable for
 * anyone navigating by keyboard or screen reader.
 *
 * Row semantics are preserved (no role override) — the row stays a row, it just
 * becomes focusable and responds to Enter / Space like the button it behaves as.
 */
export function rowActivation(onActivate: () => void, label?: string) {
  return {
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      // Ignore keys forwarded from a control inside the row (buttons, links).
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
