// Status pill — `k` is a status colour token (low/med/high/crit/info/ok/mut)
// resolved from CSS vars, so it themes automatically.
export function Pill({ text, k }: { text: string; k: string }) {
  return (
    <span
      className="inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `var(--${k}-bg)`, color: `var(--${k})` }}
    >
      {text}
    </span>
  );
}
