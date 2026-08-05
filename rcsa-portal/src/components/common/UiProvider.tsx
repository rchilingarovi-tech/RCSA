import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  /** Legacy Tailwind background class (existing call sites pass this directly). */
  color?: string;
  /** Recovery affordance — e.g. Undo after a delete. */
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Toasts carrying an action get longer. */
  duration?: number;
}

interface ToastState {
  msg: string;
  color: string;
  action?: ToastAction;
}

interface ConfirmOptions {
  /** The verb of the action. A confirm button must name what it does — "Delete"
   *  on a dialog that resets a whole module is a mislabel, not a confirmation. */
  confirmLabel?: string;
  /** 'danger' = irreversible (red). 'default' = reversible/neutral (accent). */
  tone?: 'danger' | 'default';
}

interface ConfirmState extends ConfirmOptions {
  title: string;
  msg: string;
  onConfirm: () => void;
}

interface UiApi {
  toast(msg: string, opts?: string | ToastOptions): void;
  confirm(title: string, msg: string, onConfirm: () => void, opts?: ConfirmOptions): void;
}

const UiContext = createContext<UiApi | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const toast = useCallback((msg: string, opts?: string | ToastOptions) => {
    const o: ToastOptions = typeof opts === 'string' ? { color: opts } : opts ?? {};
    setToastState({ msg, color: o.color ?? 'bg-gray-900', action: o.action });
    window.clearTimeout(timerRef.current);
    // An action needs time to be noticed and clicked; a plain ack does not.
    timerRef.current = window.setTimeout(() => setToastState(null), o.duration ?? (o.action ? 8000 : 2500));
  }, []);

  const confirm = useCallback((title: string, msg: string, onConfirm: () => void, opts?: ConfirmOptions) => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setConfirmState({ title, msg, onConfirm, ...opts });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(null);
    // Return focus to whatever opened the dialog, not to document start.
    restoreFocusRef.current?.focus?.();
  }, []);

  // Escape dismisses; focus lands on the confirm button so a keyboard user is
  // never stranded in a dialog they cannot see or leave.
  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm();
    };
    document.addEventListener('keydown', onKey);
    confirmBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  const api: UiApi = { toast, confirm };
  const danger = confirmState?.tone !== 'default';

  return (
    <UiContext.Provider value={api}>
      {children}

      {confirmState && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-bg z-[60] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-msg"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeConfirm();
          }}
        >
          <div className="modal-panel bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 id="confirm-title" className="font-bold text-gray-800">{confirmState.title}</h3>
            <p id="confirm-msg" className="text-sm text-gray-600">{confirmState.msg}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeConfirm}
                className="btn-neutral px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={() => {
                  confirmState.onConfirm();
                  closeConfirm();
                }}
                className="px-4 py-2 rounded text-sm font-semibold text-white"
                style={{ background: danger ? 'var(--crit)' : 'var(--accent)' }}
              >
                {confirmState.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastState && (
        <div className="fixed bottom-6 right-6 z-[70]" role="status" aria-live="polite">
          <div className={`${toastState.color} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-3`}>
            <span>{toastState.msg}</span>
            {toastState.action && (
              <button
                type="button"
                onClick={() => {
                  toastState.action?.onClick();
                  setToastState(null);
                }}
                className="font-semibold underline underline-offset-2 shrink-0"
              >
                {toastState.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}
