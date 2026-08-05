import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional "← Back" handler shown in the header. */
  onBack?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Tailwind max-width class for the panel, e.g. "max-w-4xl". */
  maxWidth?: string;
  /** Extra header row rendered under the title bar (e.g. tab strip). */
  headerExtra?: ReactNode;
  /** When true, an accidental dismiss (backdrop / Escape / ×) asks before
   *  discarding. A stray click must never destroy a long write-up. */
  dirty?: boolean;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  maxWidth = 'max-w-2xl',
  headerExtra,
  dirty = false,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [askDiscard, setAskDiscard] = useState(false);

  // Every dismissal route funnels through here so the guard cannot be bypassed.
  const requestClose = useCallback(() => {
    if (dirty) setAskDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      // Focus trap: Tab must cycle inside the dialog, not walk out into the page.
      if (e.key !== 'Tab') return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, requestClose]);

  // Scroll-lock + initial focus run once per open — NOT on every re-render.
  // (Callers pass a fresh inline onClose each render; focusing here would steal
  // focus from inputs on every keystroke.)
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const restore = restoreFocusRef.current;
    return () => {
      document.body.style.overflow = prevOverflow;
      // Return focus to the trigger instead of dropping the user at page start.
      restore?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // Portal to <body> so the fixed overlay is never trapped by an ancestor with a
  // containing block (transform / filter / backdrop-filter — e.g. .section-card).
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center modal-bg z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`modal-panel relative bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[92vh] overflow-y-auto outline-none`}
      >
        <div className="sticky-head px-6 py-4 border-b flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <button type="button" onClick={onBack} className="modal-back-btn">
                ← Back
              </button>
            )}
            <div>
              <h3 className="text-base font-bold text-gray-800">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {headerExtra}
        {children}

        {askDiscard && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,.45)' }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-5 space-y-3">
              <h4 className="font-bold text-gray-800 text-sm">Discard your changes?</h4>
              <p className="text-[13px] text-gray-600">This form has unsaved edits. Closing now loses them.</p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setAskDiscard(false)}
                  className="btn-neutral px-3 py-1.5 border rounded text-[13px]"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => { setAskDiscard(false); onClose(); }}
                  className="px-3 py-1.5 rounded text-[13px] font-semibold text-white"
                  style={{ background: 'var(--crit)' }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
