import type { ReactNode } from 'react';
import { Drawer } from '../layout/Drawer';

// Shared READ-ONLY record detail. Row click opens this everywhere, so viewers can
// inspect a record without edit rights and an editor can't mutate a field by
// accident mid-audit — editing is the deliberate next step, not the default.

export interface DetailField {
  label: string;
  /** Omit to render an em dash. Strings are safe; nodes allow pills/links. */
  value?: ReactNode;
  /** Full-width block (narrative text) instead of a label/value row. */
  block?: boolean;
}

export function RecordDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon,
  badges,
  fields,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Status/severity pills shown above the field list. */
  badges?: ReactNode;
  fields: DetailField[];
  footer?: ReactNode;
}) {
  const rows = fields.filter((f) => !f.block);
  const blocks = fields.filter((f) => f.block);

  return (
    <Drawer open={open} onClose={onClose} title={title} subtitle={subtitle} icon={icon} footer={footer}>
      <div className="space-y-4">
        {badges && <div className="flex flex-wrap gap-2">{badges}</div>}

        {rows.length > 0 && (
          <dl>
            {rows.map((f) => (
              <div key={f.label} className="flex gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <dt className="w-36 shrink-0 text-[12px] font-semibold" style={{ color: 'var(--text3)' }}>{f.label}</dt>
                <dd className="text-sm min-w-0 flex-1" style={{ color: 'var(--text)' }}>
                  {f.value === '' || f.value == null ? '—' : f.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {blocks.map((f) => (
          <div key={f.label}>
            <div className="text-[12px] font-semibold mb-1" style={{ color: 'var(--text3)' }}>{f.label}</div>
            <p className="text-sm whitespace-pre-wrap" style={{ color: f.value ? 'var(--text)' : 'var(--text3)' }}>
              {f.value || 'Not recorded yet.'}
            </p>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
