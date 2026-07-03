import { toneVar, type Tone } from './tones';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

interface Props {
  rows: BarRow[];
  /** Fixed scale ceiling (e.g. 100 for percentage charts). Defaults to the max value. */
  max?: number;
  /** Appended to each value label (e.g. '%'). */
  suffix?: string;
  activeKey?: string | null;
  onSelect?: (key: string) => void;
}

/** Horizontal bars with a clickable track. Empty data → "No data yet". */
export function HBarChart({ rows, max, suffix = '', activeKey = null, onSelect }: Props) {
  if (!rows.length) return <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No data yet</div>;
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  const cursor = onSelect ? 'pointer' : 'default';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map((r) => {
        const active = activeKey === r.key;
        return (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '3px 0', fontSize: 12 }}>
            <span
              title={r.label}
              style={{ width: 120, flex: '0 0 120px', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: active ? 'var(--accent)' : 'var(--text2)', fontWeight: active ? 700 : 400 }}
            >
              {r.label}
            </span>
            <span
              onClick={() => onSelect?.(r.key)}
              style={{ flex: 1, height: 16, background: 'var(--surface3)', borderRadius: 5, overflow: 'hidden', cursor }}
            >
              <i style={{ display: 'block', height: '100%', borderRadius: 5, width: `${Math.min(100, (r.value / m) * 100)}%`, background: toneVar(r.tone) }} />
            </span>
            <span style={{ minWidth: 26, fontWeight: 700, color: 'var(--text)' }}>{r.value}{suffix}</span>
          </div>
        );
      })}
    </div>
  );
}
