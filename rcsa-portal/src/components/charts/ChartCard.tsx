import type { ReactNode } from 'react';

/** Glass chart container with hover overlay (ported from .chart-container markup). */
export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="chart-container" title={title}>
      {children}
      <div className="chart-overlay" />
    </div>
  );
}
