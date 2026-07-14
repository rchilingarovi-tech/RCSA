import { Component, type ErrorInfo, type ReactNode } from 'react';

// Top-level safety net: a render error in any page shows a recoverable fallback
// instead of blanking the whole app (and never surfaces stack traces to users).
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally not logging error details anywhere user-visible.
    // Migration: report to the server-side error sink here.
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
        <div className="section-card max-w-md w-full p-8 text-center">
          <div className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>Something went wrong</div>
          <p className="text-sm mb-5" style={{ color: 'var(--text3)' }}>
            The page hit an unexpected error. Your data is safe — reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
