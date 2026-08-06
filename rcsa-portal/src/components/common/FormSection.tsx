import type { ReactNode } from 'react';

// Groups form fields by LIFECYCLE STAGE rather than by what fits on a row.
// Facts you have when you open the form lead; conclusions that only exist after
// investigation recede until they are actually answerable. Proximity and a rule
// carry the grouping — no nested cards inside a dialog.
export function FormSection({
  title,
  hint,
  /** Recede this stage: it is not answerable yet at the record's current status. */
  muted = false,
  first = false,
  children,
}: {
  title: string;
  hint?: string;
  muted?: boolean;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={first ? '' : 'pt-5 mt-5 border-t'} style={first ? undefined : { borderColor: 'var(--border)' }}>
      {/* More space above the heading than below it. */}
      <div className="mb-3">
        <h4
          className="text-[11px] font-bold uppercase tracking-wider"
          style={{ color: muted ? 'var(--text3)' : 'var(--text2)' }}
        >
          {title}
        </h4>
        {hint && (
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text3)' }}>{hint}</p>
        )}
      </div>
      <div className="space-y-4" style={muted ? { opacity: 0.72 } : undefined}>{children}</div>
    </section>
  );
}
