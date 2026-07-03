import { useCallback, useState } from 'react';

/**
 * Click-to-cross-filter primitive shared by every migrated module dashboard.
 * A chart element registers a typed predicate under a stable key; selecting the
 * same key again clears it (toggle). `apply` narrows the module's rows; the page
 * shows a "Filtered: <label> ✕" chip driven by `active`.
 *
 * This is the interaction pattern only — business rules live in each module and
 * are passed in as the predicate.
 */
export interface ChartFilter<T> {
  key: string;
  label: string;
  pred: (row: T) => boolean;
}

export interface ChartFilterApi<T> {
  active: ChartFilter<T> | null;
  activeKey: string | null;
  select: (key: string, label: string, pred: (row: T) => boolean) => void;
  clear: () => void;
  apply: (rows: T[]) => T[];
}

export function useChartFilter<T>(): ChartFilterApi<T> {
  const [active, setActive] = useState<ChartFilter<T> | null>(null);

  const select = useCallback((key: string, label: string, pred: (row: T) => boolean) => {
    setActive((cur) => (cur && cur.key === key ? null : { key, label, pred }));
  }, []);

  const clear = useCallback(() => setActive(null), []);

  const apply = useCallback((rows: T[]) => (active ? rows.filter(active.pred) : rows), [active]);

  return { active, activeKey: active?.key ?? null, select, clear, apply };
}
