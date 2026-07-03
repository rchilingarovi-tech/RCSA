import { useEffect, type ReactNode } from 'react';

// Reusable right-side slide-over panel (detail views). Closes on backdrop click,
// the × button, or Escape. Scroll-locks the body while open.
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex justify-end modal-bg"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="h-full w-[440px] max-w-full overflow-y-auto"
        style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', animation: 'drawerIn .22s ease' }}
      >
        <div className="px-6 py-5 border-b flex items-start gap-3" style={{ borderColor: 'var(--border)' }}>
          {icon && (
            <div
              className="w-11 h-11 rounded-[11px] flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent-d)' }}
            >
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold tracking-tight truncate" style={{ color: 'var(--text)' }}>{title}</div>
            {subtitle && <div className="text-[12.5px]" style={{ color: 'var(--text3)' }}>{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="hdr-btn w-[30px] h-[30px] shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>{footer}</div>}
      </div>
    </div>
  );
}
