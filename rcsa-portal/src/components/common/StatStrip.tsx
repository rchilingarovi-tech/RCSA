import type { ChartFilterApi } from '../charts/primitives/useChartFilter';
import type { Tone } from '../charts/primitives/tones';

export interface Stat<T> {
  /** Label under the number. */
  l: string;
  v: number | string;
  t?: Tone;
  /**
   * Supplying `k` + `pred` turns the card into a filter control on the register
   * below, using the same filter channel as the chart segments — so a headline
   * number and a chart slice cannot disagree about what is selected.
   */
  k?: string;
  pred?: (row: T) => boolean;
}

/**
 * The register stat strip. Cards that describe a filterable subset are real
 * buttons: "Reviews overdue: 3" should be able to show you which 3.
 * Cards without a predicate (or reading zero) stay inert — there is nothing
 * useful to select.
 */
export function StatStrip<T>({ stats, filter }: { stats: Stat<T>[]; filter?: ChartFilterApi<T> }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))' }}>
      {stats.map((s) => {
        const live = Boolean(s.k && s.pred && filter && s.v !== 0);
        const on = Boolean(s.k && filter?.activeKey === s.k);
        const tone = s.t ?? 'accent';

        const value = (
          <div className="tabular-nums text-2xl font-bold" style={{ color: s.t ? `var(--${s.t})` : 'var(--text)' }}>{s.v}</div>
        );
        const label = (
          <div className="text-[12px] mt-1" style={{ color: on ? `var(--${tone})` : 'var(--text3)' }}>
            {s.l}
            {on && <span className="ml-1 font-semibold" aria-hidden="true">✕</span>}
          </div>
        );

        if (!live) {
          return <div key={s.l} className="section-card p-4">{value}{label}</div>;
        }

        return (
          <button
            key={s.l}
            type="button"
            aria-pressed={on}
            title={on ? `Clear filter: ${s.l}` : `Filter register by ${s.l}`}
            onClick={() => filter!.select(s.k!, s.l, s.pred!)}
            className="section-card p-4 text-left w-full transition-shadow hover:shadow-md"
            // Selected state reads as a ring in the card's own tone, matching the
            // "Filtered: … ✕" chip the chart panels already use.
            style={on ? { boxShadow: `inset 0 0 0 2px var(--${tone})` } : undefined}
          >
            {value}
            {label}
          </button>
        );
      })}
    </div>
  );
}
