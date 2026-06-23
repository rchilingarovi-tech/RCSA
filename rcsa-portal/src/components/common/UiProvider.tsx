import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastState {
  msg: string;
  color: string;
}

interface ConfirmState {
  title: string;
  msg: string;
  onConfirm: () => void;
}

interface UiApi {
  toast(msg: string, color?: string): void;
  confirm(title: string, msg: string, onConfirm: () => void): void;
}

const UiContext = createContext<UiApi | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string, color = 'bg-gray-900') => {
    setToastState({ msg, color });
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToastState(null), 2500);
  }, []);

  const confirm = useCallback((title: string, msg: string, onConfirm: () => void) => {
    setConfirmState({ title, msg, onConfirm });
  }, []);

  const api: UiApi = { toast, confirm };

  return (
    <UiContext.Provider value={api}>
      {children}

      {/* Confirm modal (ported from #confirm-modal) */}
      {confirmState && (
        <div
          className="fixed inset-0 flex items-center justify-center modal-bg z-[60] p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmState(null);
          }}
        >
          <div className="modal-panel bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-gray-800">{confirmState.title}</h3>
            <p className="text-sm text-gray-600">{confirmState.msg}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmState(null)}
                className="btn-neutral px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-ok"
                onClick={() => {
                  confirmState.onConfirm();
                  setConfirmState(null);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (ported from #toast) */}
      {toastState && (
        <div className="fixed bottom-6 right-6 z-[70]" role="status" aria-live="polite">
          <div className={`${toastState.color} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg`}>
            {toastState.msg}
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
