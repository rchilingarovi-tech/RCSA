import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type SortDir = 'asc' | 'desc';

/**
 * Per-column sort value. Return a number for ranked/numeric columns
 * (`r => SEVERITY_RANK[r.severity]`), a string for text and ISO dates
 * (lexicographic order on `YYYY-MM-DD` is chronological order).
 * Return '' / null for "no value" — blanks always sort last, in both
 * directions, so missing data never leads the table.
 */
export type SortKeys<T> = Record<string, (row: T) => string | number | null | undefined>;

const isBlank = (v: unknown): boolean => v === null || v === undefined || v === '';

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  // Blanks last regardless of direction — the caller re-flips by `dir`, so we
  // return the pre-flip order and let the caller's multiplier skip these.
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export interface TableSort<T> {
  rows: T[];
  sort: { key: string; dir: SortDir };
  setSort: (s: { key: string; dir: SortDir }) => void;
  /** Renders a `<th>` whose label is a real button — keyboard-reachable, and
   *  `aria-sort` announces direction rather than relying on a caret glyph. */
  sortable: (key: string, label: ReactNode, extraClass?: string, style?: CSSProperties) => ReactNode;
}

/**
 * Adds click-to-sort to any register table. Sorting is applied to the rows the
 * page already filtered, so it composes with search and chart filters instead
 * of competing with them.
 */
export function useTableSort<T>(
  rows: T[],
  keys: SortKeys<T>,
  initial: { key: string; dir: SortDir },
  thClass = 'text-left px-4 py-3 text-[10.5px] font-semibold tracking-wide uppercase',
): TableSort<T> {
  const [sort, setSort] = useState(initial);

  // `keys` is rebuilt every render by the caller; hold it in a ref so the memo
  // depends only on the data and the chosen column.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const sorted = useMemo(() => {
    const get = keysRef.current[sort.key];
    if (!get) return rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      // Blanks stay last in both directions: settle them before flipping.
      if (isBlank(va) || isBlank(vb)) return compare(va, vb);
      return compare(va, vb) * dir;
    });
  }, [rows, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const sortable = (key: string, label: ReactNode, extraClass = '', style?: CSSProperties): ReactNode => {
    const active = sort.key === key;
    return (
      <th
        key={key}
        className={`${thClass} select-none ${extraClass}`}
        style={style}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide cursor-pointer hover:opacity-80"
          style={active ? { color: 'var(--text)' } : undefined}
        >
          {label}
          {/* Reserve the caret's width always, so the header row does not
              reflow when the active column changes. */}
          <span aria-hidden="true" className="inline-block w-2 text-[9px] leading-none" style={{ opacity: active ? 1 : 0.35 }}>
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </button>
      </th>
    );
  };

  return { rows: sorted, sort, setSort, sortable };
}
