import { toneVar, type Tone } from './tones';

interface Props {
  values: number[];
  tone?: Tone;
  width?: number;
  height?: number;
}

/** Minimal trend line. Renders a muted note when there isn't enough real history. */
export function Sparkline({ values, tone = 'accent', width = 92, height = 26 }: Props) {
  const clean = (values ?? []).filter((v) => Number.isFinite(v));
  if (clean.length < 2) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>no history</span>;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const pad = 3;
  const pts = clean
    .map((v, i) => {
      const x = (i / (clean.length - 1)) * (width - pad * 2) + pad;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={toneVar(tone)} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
