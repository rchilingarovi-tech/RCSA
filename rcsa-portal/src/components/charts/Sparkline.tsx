// Reusable inline-SVG sparkline (no chart library). Scales to its container
// width; colour is passed in (usually a RAG status CSS var).
export function Sparkline({
  values,
  color = 'var(--accent)',
  width = 120,
  height = 34,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const p = 3;
  if (values.length < 2) {
    const y = height / 2;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
        <line x1={p} y1={y} x2={width - p} y2={y} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      </svg>
    );
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const xs = (i: number) => p + (width - 2 * p) * (i / (values.length - 1));
  const ys = (v: number) => p + (height - 2 * p) * (1 - (v - min) / (max - min || 1));
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs(values.length - 1)} cy={ys(values[values.length - 1])} r={2.6} fill={color} />
    </svg>
  );
}
