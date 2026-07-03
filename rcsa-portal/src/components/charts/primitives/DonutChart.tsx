import type { ReactNode } from 'react';
import { toneVar, type Tone } from './tones';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

interface Props {
  segments: DonutSegment[];
  center?: string;
  sub?: string;
  activeKey?: string | null;
  onSelect?: (key: string) => void;
}

const EMPTY = <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No data yet</div>;

/**
 * SVG donut with a clickable legend. A single non-zero category renders as a full
 * ring (not a fake segment). All-zero renders the "No data yet" empty state.
 */
export function DonutChart({ segments, center, sub, activeKey = null, onSelect }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return EMPTY;

  const cx = 75, cy = 75, r = 60, ir = 39, gap = 0.018;
  const nz = segments.filter((s) => s.value > 0);
  const cursor = onSelect ? 'pointer' : 'default';

  let body: ReactNode;
  if (nz.length === 1) {
    const s = nz[0];
    body = (
      <circle
        cx={cx} cy={cy} r={(r + ir) / 2} fill="none"
        stroke={toneVar(s.tone)} strokeWidth={r - ir}
        style={{ cursor }} onClick={() => onSelect?.(s.key)}
      />
    );
  } else {
    let a0 = -Math.PI / 2;
    body = nz.map((s) => {
      const a1 = a0 + (s.value / total) * 2 * Math.PI;
      const st = a0 + gap;
      const en = Math.max(st + 0.005, a1 - gap);
      const large = en - st > Math.PI ? 1 : 0;
      const d =
        `M ${(cx + r * Math.cos(st)).toFixed(2)} ${(cy + r * Math.sin(st)).toFixed(2)} ` +
        `A ${r} ${r} 0 ${large} 1 ${(cx + r * Math.cos(en)).toFixed(2)} ${(cy + r * Math.sin(en)).toFixed(2)} ` +
        `L ${(cx + ir * Math.cos(en)).toFixed(2)} ${(cy + ir * Math.sin(en)).toFixed(2)} ` +
        `A ${ir} ${ir} 0 ${large} 0 ${(cx + ir * Math.cos(st)).toFixed(2)} ${(cy + ir * Math.sin(st)).toFixed(2)} Z`;
      a0 = a1;
      const active = activeKey === s.key;
      return (
        <path
          key={s.key} d={d} fill={toneVar(s.tone)}
          stroke={active ? 'var(--text)' : 'none'} strokeWidth={active ? 1.6 : 0}
          style={{ cursor }} onClick={() => onSelect?.(s.key)}
        />
      );
    });
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={150} height={150} viewBox="0 0 150 150" style={{ flex: '0 0 auto' }}>
        {body}
        {center != null && (
          <text x={75} y={73} textAnchor="middle" style={{ fontSize: 23, fontWeight: 700, fill: 'var(--text)' }}>{center}</text>
        )}
        {sub != null && (
          <text x={75} y={91} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--text3)' }}>{sub}</text>
        )}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 130, flex: 1 }}>
        {segments.map((s) => {
          const active = activeKey === s.key;
          return (
            <button
              key={s.key} type="button" onClick={() => onSelect?.(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, border: 0,
                background: active ? 'var(--ok-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text2)', fontWeight: active ? 600 : 400,
                padding: '4px 7px', borderRadius: 7, textAlign: 'left', width: '100%', cursor, fontSize: 12,
              }}
            >
              <i style={{ width: 10, height: 10, borderRadius: 3, background: toneVar(s.tone), flex: '0 0 auto' }} />
              {s.label}
              <b style={{ marginLeft: 'auto', color: 'var(--text)', fontWeight: 600 }}>{s.value}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}
