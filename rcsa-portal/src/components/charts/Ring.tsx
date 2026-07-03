// Reusable SVG progress ring (no chart library). Used for coverage / score
// dials across modules. Colours come from CSS vars so it themes automatically.
export function Ring({
  pct,
  size = 120,
  stroke = 12,
  color = 'var(--accent)',
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text
        x="50%"
        y={label ? '46%' : '50%'}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fontSize: size * 0.24, fontWeight: 700, fill: 'var(--text)' }}
      >
        {pct}%
      </text>
      {label && (
        <text
          x="50%"
          y="64%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: size * 0.1, fill: 'var(--text3)' }}
        >
          {label}
        </text>
      )}
    </svg>
  );
}
