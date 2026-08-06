import { Children, isValidElement, useMemo, useState, type ReactElement, type ReactNode } from 'react';

// 12-column responsive grid. Panels span 4/6/8/12 on lg+, and collapse to full
// width below lg. Literal class strings so Tailwind keeps them.
const SPAN: Record<number, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

const slugOf = (v: unknown, i: number): string =>
  typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `item-${i}`;

/**
 * 12-col chart grid. Pass `sortKey` to enable drag-to-reorder: each child gets a
 * grab handle (visible on hover); the order persists per page in localStorage,
 * keyed by the child's `title` prop so hidden/shown panels keep their place.
 */
export function ChartGrid({
  children,
  sortKey,
  collapsible = false,
}: {
  children: ReactNode;
  sortKey?: string;
  /** Register pages: the table is the work and the charts are context, so the
   *  band can be folded away. Off by default — pages where the charts ARE the
   *  content (overview, calendar) must never be collapsible. */
  collapsible?: boolean;
}) {
  const grid = sortKey
    ? <SortableGrid sortKey={sortKey}>{children}</SortableGrid>
    : <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">{children}</div>;

  if (!collapsible || !sortKey) return grid;
  return <CollapsibleBand storeKey={`infosec.charts.${sortKey}.collapsed`}>{grid}</CollapsibleBand>;
}

/** Starts expanded: nothing disappears unless the user chose to fold it. */
function CollapsibleBand({ storeKey, children }: { storeKey: string; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(storeKey) === '1'; } catch { return false; }
  });
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(storeKey, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="no-print text-[11.5px] font-semibold inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:opacity-80"
          style={{ color: 'var(--text3)' }}
        >
          {collapsed ? 'Show charts' : 'Hide charts'}
          <span aria-hidden="true" className="text-[9px] leading-none">{collapsed ? '▼' : '▲'}</span>
        </button>
      </div>
      {!collapsed && children}
    </div>
  );
}

function SortableGrid({ sortKey, children }: { sortKey: string; children: ReactNode }) {
  const storeKey = `infosec.order.${sortKey}`;
  const els = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const ids = els.map((el, i) => slugOf((el.props as { title?: unknown }).title, i));

  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? (arr as string[]) : [];
    } catch {
      return [];
    }
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);

  // Saved order ∩ current panels, then any new panels appended in natural order.
  const ordered = useMemo(() => {
    const present = new Set(ids);
    const kept = saved.filter((id) => present.has(id));
    const missing = ids.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
  }, [ids.join('|'), saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = new Map(ids.map((id, i) => [id, els[i]]));

  const applyOrder = (next: string[]) => {
    setSaved(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const moveTo = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = ordered.indexOf(dragId);
    const next = ordered.filter((x) => x !== dragId);
    const ti = next.indexOf(targetId);
    if (ti === -1) return;
    // Dragging forward drops after the target; backward drops before it — the
    // classic live-swap feel.
    next.splice(from < ordered.indexOf(targetId) ? ti + 1 : ti, 0, dragId);
    applyOrder(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {ordered.map((id) => {
        const el = byId.get(id);
        if (!el) return null;
        const span = SPAN[(el.props as { span?: number }).span ?? 4] ?? SPAN[4];
        return (
          <div
            key={id}
            className={`relative group/drag min-w-0 ${span} ${dragId === id ? 'opacity-60' : ''}`}
            draggable={armedId === id}
            onDragStart={(e) => {
              if (armedId !== id) { e.preventDefault(); return; }
              setDragId(id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnter={() => moveTo(id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => { setDragId(null); setArmedId(null); }}
          >
            <button
              type="button"
              title="Drag to reorder"
              aria-label="Drag to reorder"
              onMouseDown={() => setArmedId(id)}
              onMouseUp={() => setArmedId(null)}
              className="no-print absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-md border hidden lg:group-hover/drag:flex items-center justify-center cursor-grab active:cursor-grabbing text-[13px] leading-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text3)' }}
            >
              ⠿
            </button>
            {el}
          </div>
        );
      })}
    </div>
  );
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
            style={{ background: 'var(--ok-bg)', color: 'var(--link)' }}
          >
            Filtered: {filterLabel} ✕
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}
