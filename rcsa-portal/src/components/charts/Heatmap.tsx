// Grid risk heatmap: Likelihood (x) × Impact (y), cells coloured by score band
// and labelled with the count. Fully fluid — every track is flex-1 with min-h-0,
// so it scales down cleanly inside small dashboard cells. Click a cell to filter.

type Props = {
  /** Number of risks at this Impact × Likelihood combination. */
  count: (impact: number, likelihood: number) => number;
  onCell: (impact: number, likelihood: number) => void;
  active?: { i: number; l: number } | null;
  title?: string;
};

const band = (s: number) => (s >= 20 ? 'crit' : s >= 12 ? 'high' : s >= 6 ? 'med' : 'low');
const IMPACTS = [5, 4, 3, 2, 1]; // top → bottom
const LIKS = [1, 2, 3, 4, 5]; // left → right
const LEGEND: [string, string][] = [['Critical', 'crit'], ['High', 'high'], ['Medium', 'med'], ['Low', 'low']];

export function Heatmap({ count, onCell, active, title = 'Residual Heat Map' }: Props) {
  return (
    <div className="flex flex-col w-full h-full min-h-0">
      <div className="text-center text-[13px] font-semibold mb-1.5 shrink-0" style={{ color: 'var(--text)' }}>{title}</div>

      <div className="flex-1 flex min-h-0 gap-1">
        {/* Impact axis caption */}
        <div className="flex items-center shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Impact</span>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Rows (Impact 5 → 1) */}
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            {IMPACTS.map((imp) => (
              <div key={imp} className="flex-1 flex gap-1 min-h-0">
                <div className="flex items-center justify-center w-3.5 shrink-0 text-[10px] font-semibold" style={{ color: 'var(--text3)' }}>{imp}</div>
                {LIKS.map((lik) => {
                  const c = count(imp, lik);
                  const k = band(imp * lik);
                  const sel = !!active && active.i === imp && active.l === lik;
                  return (
                    <button
                      key={lik}
                      type="button"
                      onClick={() => onCell(imp, lik)}
                      title={`Impact ${imp} × Likelihood ${lik} — ${c} risk${c === 1 ? '' : 's'}`}
                      className="flex-1 min-w-0 rounded-md flex items-center justify-center font-bold transition-transform hover:scale-[1.04]"
                      style={{
                        background: `var(--${k})`,
                        opacity: c ? 1 : 0.3,
                        color: '#fff',
                        fontSize: 'clamp(9px, 1.5vw, 13px)',
                        outline: sel ? '2px solid var(--text)' : 'none',
                        outlineOffset: -2,
                      }}
                    >
                      {c || ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Column labels (Likelihood 1 → 5) */}
          <div className="flex gap-1 mt-1 shrink-0">
            <div className="w-3.5 shrink-0" />
            {LIKS.map((l) => (
              <div key={l} className="flex-1 text-center text-[10px] font-semibold" style={{ color: 'var(--text3)' }}>{l}</div>
            ))}
          </div>
          <div className="text-center text-[9px] font-bold uppercase tracking-wider mt-0.5 shrink-0" style={{ color: 'var(--text3)' }}>Likelihood →</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 mt-1.5 shrink-0">
        {LEGEND.map(([lbl, k]) => (
          <span key={k} className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text2)' }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: `var(--${k})` }} />{lbl}
          </span>
        ))}
      </div>
    </div>
  );
}
