import type { ReactNode } from 'react';

// 12-column responsive grid. Panels span 4/6/8/12 on lg+, and collapse to full
// width below lg. Literal class strings so Tailwind keeps them.
const SPAN: Record<number, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

export function ChartGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">{children}</div>;
}

interface PanelProps {
  title: ReactNode;
  span?: 4 | 6 | 8 | 12;
  /** When set, shows a "Filtered: <label> ✕" chip that calls onClearFilter. */
  filterLabel?: string | null;
  onClearFilter?: () => void;
  children: ReactNode;
}

export function ChartPanel({ title, span = 4, filterLabel, onClearFilter, children }: PanelProps) {
  // h-full + stretch (grid default) → every panel in a row is the same height.
  // The content area flexes and centers so short charts fill the space instead of
  // leaving dead whitespace at the bottom.
  return (
    <div className={`section-card p-4 flex flex-col h-full ${SPAN[span]}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{title}</h3>
        {filterLabel && (
          <button
            onClick={onClearFilter}
            className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'var(--ok-bg)', color: 'var(--accent)' }}
          >
            Filtered: {filterLabel} ✕
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
