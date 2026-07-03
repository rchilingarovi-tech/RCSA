import { useEffect, useRef, type ReactNode } from 'react';
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
  children: ReactNode;
}

export function Modal({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  maxWidth = 'max-w-2xl',
  headerExtra,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Scroll-lock + initial focus run once per open — NOT on every re-render.
  // (Callers pass a fresh inline onClose each render; focusing here would steal
  // focus from inputs on every keystroke.)
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  // Portal to <body> so the fixed overlay is never trapped by an ancestor with a
  // containing block (transform / filter / backdrop-filter — e.g. .section-card).
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center modal-bg z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`modal-panel bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[92vh] overflow-y-auto outline-none`}
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
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {headerExtra}
        {children}
      </div>
    </div>,
    document.body,
  );
}
