// Shared progress bar with a trailing % label. Colour passed in.
export function ProgressBar({ pct, color = 'var(--accent)' }: { pct: number; color?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded" style={{ background: 'var(--surface3)' }}>
        <div className="h-full rounded" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: 'var(--text3)' }}>{v}%</span>
    </div>
  );
}
